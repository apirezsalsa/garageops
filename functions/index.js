import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { getMessaging } from 'firebase-admin/messaging';
import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { defineSecret } from 'firebase-functions/params';
import { logger } from 'firebase-functions';
import Stripe from 'stripe';
import { matchPlanByPriceId, pickFallbackFreePlanId } from './src/planMatching.js';
import { computeDueAlerts, buildNotificationPayload } from './src/alertNotifications.js';

initializeApp();
const db = getFirestore();
const auth = getAuth();
const messaging = getMessaging();

const STRIPE_SECRET_KEY = defineSecret('STRIPE_SECRET_KEY');
const STRIPE_WEBHOOK_SECRET = defineSecret('STRIPE_WEBHOOK_SECRET');

// URL base de la app privada, usada para las redirecciones de vuelta desde Stripe Checkout / Portal
const APP_URL = 'https://app.mygarageops.com';

function getStripe(secretKey) {
  return new Stripe(secretKey, { apiVersion: '2024-11-20.acacia' });
}

async function fetchPlans() {
  const snap = await db.collection('plans').get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// Encuentra el plan de Firestore cuyo Price ID (mensual o anual) coincide con el recibido de Stripe
async function findPlanByStripePriceId(priceId) {
  return matchPlanByPriceId(await fetchPlans(), priceId);
}

// Plan al que se revierte a un usuario cuando su suscripción de pago termina o se cancela
async function getFallbackFreePlanId() {
  const snap = await db.collection('plans').where('active', '!=', false).get();
  return pickFallbackFreePlanId(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
}

// Encuentra el uid de Firebase de un cliente de Stripe cuando el evento no trae metadata (p.ej. facturas)
async function findUidByStripeCustomerId(customerId) {
  const snap = await db.collection('users').where('stripeCustomerId', '==', customerId).limit(1).get();
  return snap.empty ? null : snap.docs[0].id;
}

// Extrae marca y últimos 4 dígitos de la tarjeta usada para pagar una factura, si la hay.
// Se relee la factura con el método de pago expandido: el objeto del evento del webhook no lo incluye.
async function getCardSummary(stripe, invoiceId) {
  if (!invoiceId) return {};
  try {
    const invoice = await stripe.invoices.retrieve(invoiceId, { expand: ['payment_intent.payment_method'] });
    const card = invoice.payment_intent?.payment_method?.card;
    return card ? { cardBrand: card.brand, cardLast4: card.last4 } : {};
  } catch (err) {
    logger.warn('No se pudo recuperar el detalle de la tarjeta', err);
    return {};
  }
}

// Registra un evento de facturación en Firestore para el histórico de Transacciones del Backoffice.
// Usa el ID del evento de Stripe como ID del documento: los reintentos del webhook no duplican la entrada.
async function logTransaction(event, {
  uid, type, planId, planName, previousPlanId, billingCycle, amount, currency, status,
  cancellationReason, hostedInvoiceUrl, cardBrand, cardLast4
}) {
  const userSnap = await db.collection('users').doc(uid).get();
  await db.collection('transactions').doc(event.id).set({
    uid,
    email: userSnap.data()?.email || null,
    type,
    planId: planId || null,
    planName: planName || null,
    previousPlanId: previousPlanId || null,
    billingCycle: billingCycle || null,
    amount: amount ?? null,
    currency: currency || null,
    status: status || null,
    cancellationReason: cancellationReason || null,
    hostedInvoiceUrl: hostedInvoiceUrl || null,
    cardBrand: cardBrand || null,
    cardLast4: cardLast4 || null,
    createdAt: FieldValue.serverTimestamp()
  });
}

// Callable: crea una sesión de Stripe Checkout (suscripción) para el plan/ciclo elegido por el usuario autenticado
export const createCheckoutSession = onCall({ secrets: [STRIPE_SECRET_KEY], enforceAppCheck: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const { planId, billingCycle } = request.data || {};
  if (!planId || !['monthly', 'annual'].includes(billingCycle)) {
    throw new HttpsError('invalid-argument', 'planId y billingCycle (monthly|annual) son obligatorios.');
  }

  const planSnap = await db.collection('plans').doc(planId).get();
  if (!planSnap.exists) throw new HttpsError('not-found', 'Plan no encontrado.');
  const plan = planSnap.data();
  const priceId = billingCycle === 'annual' ? plan.stripePriceIdAnnual : plan.stripePriceIdMonthly;
  if (!priceId) throw new HttpsError('failed-precondition', 'Este plan todavía no tiene un precio de Stripe configurado.');

  const stripe = getStripe(STRIPE_SECRET_KEY.value());
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.data() || {};

  let customerId = userData.stripeCustomerId;
  if (customerId) {
    // stripeCustomerId es escribible por el propio usuario desde el cliente: verificamos que el
    // Customer de Stripe realmente le pertenece antes de reutilizarlo, para evitar que alguien
    // escriba el customerId de otra persona y acceda a su suscripción/facturación.
    const existing = await stripe.customers.retrieve(customerId);
    if (existing.deleted || existing.metadata?.firebaseUid !== uid) {
      customerId = null;
    }
  }
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: request.auth.token.email || undefined,
      metadata: { firebaseUid: uid }
    });
    customerId = customer.id;
    await userRef.set({ stripeCustomerId: customerId }, { merge: true });
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    // Permite a Checkout guardar en el cliente la dirección de facturación que recoge para calcular el impuesto
    customer_update: { address: 'auto', name: 'auto' },
    line_items: [{ price: priceId, quantity: 1 }],
    // Stripe Tax calcula el IVA/sales tax correcto según el país (y código postal) del cliente y lo desglosa
    // en la factura. Requiere tener Stripe Tax activado y al menos un registro fiscal en el dashboard de Stripe.
    automatic_tax: { enabled: true },
    // Recoge el NIF/VAT del cliente cuando es una empresa, para aplicar inversión del sujeto pasivo (B2B UE)
    tax_id_collection: { enabled: true },
    success_url: `${APP_URL}/?checkout=success`,
    cancel_url: `${APP_URL}/?checkout=cancelled`,
    subscription_data: {
      metadata: { firebaseUid: uid, planId, billingCycle }
    },
    metadata: { firebaseUid: uid, planId, billingCycle }
  });

  return { url: session.url };
});

// Callable: crea una sesión del Billing Portal de Stripe para que el usuario gestione o cancele su suscripción
export const createPortalSession = onCall({ secrets: [STRIPE_SECRET_KEY], enforceAppCheck: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const userSnap = await db.collection('users').doc(uid).get();
  const customerId = userSnap.data()?.stripeCustomerId;
  if (!customerId) throw new HttpsError('failed-precondition', 'Este usuario todavía no tiene una suscripción de Stripe.');

  const stripe = getStripe(STRIPE_SECRET_KEY.value());

  // stripeCustomerId es escribible por el propio usuario desde el cliente: verificamos que el
  // Customer de Stripe realmente le pertenece antes de abrirle el Billing Portal de otra persona.
  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted || customer.metadata?.firebaseUid !== uid) {
    throw new HttpsError('permission-denied', 'No tienes permiso para acceder a esta suscripción.');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${APP_URL}/`
  });

  return { url: session.url };
});

// Webhook de Stripe: sincroniza el plan del usuario en Firestore según el estado real de su suscripción
export const stripeWebhook = onRequest({ secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET] }, async (req, res) => {
  const stripe = getStripe(STRIPE_SECRET_KEY.value());
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET.value());
  } catch (err) {
    logger.error('Firma de webhook inválida', err);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const uid = session.metadata?.firebaseUid;
        if (uid && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          const priceId = subscription.items.data[0]?.price?.id;
          const matchedPlan = await findPlanByStripePriceId(priceId);
          await db.collection('users').doc(uid).set({
            plan: matchedPlan?.id || session.metadata.planId,
            billingCycle: matchedPlan?.billingCycle || session.metadata.billingCycle,
            pendingPlanChange: null,
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });

          let hostedInvoiceUrl, cardInfo = {};
          if (session.invoice) {
            const invoice = await stripe.invoices.retrieve(session.invoice);
            hostedInvoiceUrl = invoice.hosted_invoice_url;
            cardInfo = await getCardSummary(stripe, invoice.id);
          }

          await logTransaction(event, {
            uid,
            type: 'alta',
            planId: matchedPlan?.id || session.metadata.planId,
            planName: matchedPlan?.name,
            billingCycle: matchedPlan?.billingCycle || session.metadata.billingCycle,
            amount: (session.amount_total || 0) / 100,
            currency: session.currency,
            status: subscription.status,
            hostedInvoiceUrl,
            ...cardInfo
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const uid = subscription.metadata?.firebaseUid;
        if (uid) {
          const userRef = db.collection('users').doc(uid);
          const previousPlanId = (await userRef.get()).data()?.plan || null;

          const priceId = subscription.items.data[0]?.price?.id;
          const matchedPlan = await findPlanByStripePriceId(priceId);
          const update = {
            stripeSubscriptionId: subscription.id,
            subscriptionStatus: subscription.status,
            updatedAt: FieldValue.serverTimestamp()
          };
          if (matchedPlan) {
            update.plan = matchedPlan.id;
            update.billingCycle = matchedPlan.billingCycle;
          }
          await userRef.set(update, { merge: true });
          const price = subscription.items.data[0]?.price;
          await logTransaction(event, {
            uid,
            type: 'modificacion',
            planId: matchedPlan?.id,
            planName: matchedPlan?.name,
            previousPlanId: matchedPlan && matchedPlan.id !== previousPlanId ? previousPlanId : null,
            billingCycle: matchedPlan?.billingCycle,
            amount: price?.unit_amount != null ? price.unit_amount / 100 : null,
            currency: price?.currency,
            status: subscription.status
          });
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const uid = subscription.metadata?.firebaseUid;
        if (uid) {
          const previousPlanId = (await db.collection('users').doc(uid).get()).data()?.plan || null;
          const fallbackPlanId = await getFallbackFreePlanId();
          await db.collection('users').doc(uid).set({
            plan: fallbackPlanId,
            billingCycle: 'monthly',
            pendingPlanChange: null,
            subscriptionStatus: 'canceled',
            updatedAt: FieldValue.serverTimestamp()
          }, { merge: true });
          await logTransaction(event, {
            uid,
            type: 'baja',
            planId: fallbackPlanId,
            previousPlanId,
            billingCycle: 'monthly',
            status: 'canceled',
            cancellationReason: subscription.cancellation_details?.reason || subscription.cancellation_details?.feedback || null
          });
        }
        break;
      }
      // Cobro recurrente cobrado con éxito (renovación mensual/anual). El primer pago ya se registra como
      // 'alta' en checkout.session.completed, así que aquí solo se registran los cobros posteriores.
      case 'invoice.paid': {
        const invoice = event.data.object;
        if (invoice.billing_reason === 'subscription_create') break;

        const uid = invoice.subscription
          ? (await stripe.subscriptions.retrieve(invoice.subscription)).metadata?.firebaseUid
          : null;
        const resolvedUid = uid || (invoice.customer ? await findUidByStripeCustomerId(invoice.customer) : null);
        if (resolvedUid) {
          const priceId = invoice.lines.data[0]?.price?.id;
          const matchedPlan = priceId ? await findPlanByStripePriceId(priceId) : null;
          const cardInfo = await getCardSummary(stripe, invoice.id);
          await logTransaction(event, {
            uid: resolvedUid,
            type: 'pago',
            planId: matchedPlan?.id,
            planName: matchedPlan?.name,
            billingCycle: matchedPlan?.billingCycle,
            amount: (invoice.amount_paid || 0) / 100,
            currency: invoice.currency,
            status: 'paid',
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            ...cardInfo
          });
        }
        break;
      }
      // Cobro recurrente rechazado (tarjeta caducada, fondos insuficientes...). Crítico para detectar impagos.
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const uid = invoice.subscription
          ? (await stripe.subscriptions.retrieve(invoice.subscription)).metadata?.firebaseUid
          : null;
        const resolvedUid = uid || (invoice.customer ? await findUidByStripeCustomerId(invoice.customer) : null);
        if (resolvedUid) {
          const priceId = invoice.lines.data[0]?.price?.id;
          const matchedPlan = priceId ? await findPlanByStripePriceId(priceId) : null;
          await logTransaction(event, {
            uid: resolvedUid,
            type: 'pago_fallido',
            planId: matchedPlan?.id,
            planName: matchedPlan?.name,
            billingCycle: matchedPlan?.billingCycle,
            amount: (invoice.amount_due || 0) / 100,
            currency: invoice.currency,
            status: 'failed',
            hostedInvoiceUrl: invoice.hosted_invoice_url
          });
        }
        break;
      }
      default:
        break;
    }
    res.json({ received: true });
  } catch (err) {
    logger.error('Error procesando evento de webhook', err);
    res.status(500).send('Internal error');
  }
});

// Callable: borra por completo la cuenta de un usuario (solo admins). El SDK cliente no puede borrar
// cuentas de Firebase Auth de otros usuarios, por eso hace falta esta función con Admin SDK — borrar solo
// el documento de Firestore (como hacía antes el Backoffice) dejaba la cuenta de Auth viva, así que el
// usuario podía volver a iniciar sesión y su perfil se recreaba solo.
export const deleteUserAccount = onCall({ enforceAppCheck: true }, async (request) => {
  const callerUid = request.auth?.uid;
  if (!callerUid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  const callerSnap = await db.collection('users').doc(callerUid).get();
  if (callerSnap.data()?.role !== 'admin') {
    throw new HttpsError('permission-denied', 'Solo un administrador puede eliminar cuentas.');
  }

  const { targetUid } = request.data || {};
  if (!targetUid) throw new HttpsError('invalid-argument', 'Falta el ID del usuario a eliminar.');
  if (targetUid === callerUid) {
    throw new HttpsError('failed-precondition', 'No puedes eliminar tu propia cuenta de administrador.');
  }

  // Borra los datos propios del usuario (vehículos, repuestos, mantenimientos) antes que el perfil
  for (const colName of ['vehicles', 'parts', 'maintenances']) {
    const snap = await db.collection(colName).where('userId', '==', targetUid).get();
    if (!snap.empty) {
      const batch = db.batch();
      snap.docs.forEach(d => batch.delete(d.ref));
      await batch.commit();
    }
  }

  await db.collection('users').doc(targetUid).delete();

  // Borra la cuenta de Firebase Auth para que no pueda volver a iniciar sesión ni resucitar el perfil
  try {
    await auth.deleteUser(targetUid);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') {
      logger.error('Error al borrar el usuario de Firebase Auth', err);
      throw new HttpsError('internal', 'Se borraron los datos pero falló eliminar la cuenta de acceso.');
    }
  }

  return { success: true };
});

// Envía un push a todos los dispositivos registrados de un usuario y limpia del array `fcmTokens`
// los tokens que FCM reporta como inválidos/no registrados (dispositivo desinstaló la app, etc.)
async function sendPushToUser(uid, { title, body }) {
  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const tokens = userSnap.data()?.fcmTokens || [];
  if (tokens.length === 0) return;

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: { title, body }
  });

  const invalidTokens = [];
  response.responses.forEach((res, i) => {
    if (!res.success && ['messaging/invalid-registration-token', 'messaging/registration-token-not-registered'].includes(res.error?.code)) {
      invalidTokens.push(tokens[i]);
    }
  });
  if (invalidTokens.length > 0) {
    await userRef.update({ fcmTokens: FieldValue.arrayRemove(...invalidTokens) });
  }
}

// Programada: revisa cada día las alertas de todos los vehículos y envía un push (una sola vez por
// alerta) a los que estén vencidas o próximas. Ver functions/src/alertNotifications.js para la lógica.
export const checkVehicleAlerts = onSchedule({ schedule: 'every day 08:00', timeZone: 'Europe/Madrid' }, async () => {
  const vehiclesSnap = await db.collection('vehicles').get();

  for (const vehicleDoc of vehiclesSnap.docs) {
    const vehicle = vehicleDoc.data();
    const dueAlerts = computeDueAlerts(vehicle);
    if (dueAlerts.length === 0) continue;

    try {
      await sendPushToUser(vehicle.userId, buildNotificationPayload(vehicle, dueAlerts));

      const dueIds = new Set(dueAlerts.map((a) => a.id));
      const updatedAlerts = (vehicle.alerts || []).map((a) => (dueIds.has(a.id) ? { ...a, notified: true } : a));
      await vehicleDoc.ref.update({ alerts: updatedAlerts });
    } catch (err) {
      logger.error(`Error notificando alertas del vehículo ${vehicleDoc.id}`, err);
    }
  }
});

// Callable: envía un push de prueba al usuario autenticado, para verificar de punta a punta que el
// permiso, el token guardado y el envío desde el backend funcionan, sin esperar al cron diario.
export const sendTestPushNotification = onCall({ enforceAppCheck: true }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', 'Debes iniciar sesión.');

  await sendPushToUser(uid, {
    title: 'MyGarageOps',
    body: 'Notificación de prueba: si ves esto, las alertas push funcionan.'
  });

  return { success: true };
});

// Sincroniza hacia Stripe los cambios de nombre y precio hechos en un plan desde el Backoffice.
// El nombre se actualiza en el Product directamente. El precio en Stripe es inmutable una vez
// creado: "cambiarlo" significa crear un Price nuevo, archivar el anterior (para que solo afecte
// a altas nuevas, no a quien ya estaba suscrito al precio viejo) y guardar el Price ID nuevo de
// vuelta en el propio documento del plan, para que el checkout lo recoja automáticamente.
//
// Solo actúa si el plan ya tiene `stripeProductId` (se enlaza a mano una vez por plan, ver
// Firestore): así nunca crea Products nuevos en Stripe por su cuenta, solo mantiene sincronizados
// los que alguien ya decidió conectar.
//
// Nota: si en el futuro hay suscriptores activos y se cambia el precio de su plan, los webhooks de
// Stripe para su suscripción seguirán llegando con el Price ID antiguo (ya archivado), que dejará
// de coincidir con el Price ID guardado en el plan. Hoy no hay suscriptores de pago reales, así que
// no hace falta un mapeo histórico de precios; revisar `findPlanByStripePriceId` si eso cambia.
export const syncPlanToStripe = onDocumentUpdated({ document: 'plans/{planId}', secrets: [STRIPE_SECRET_KEY] }, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();
  if (!after?.stripeProductId) return;

  const nameChanged = before.name !== after.name;
  const monthlyChanged = Number(before.priceMonthly) !== Number(after.priceMonthly);
  const annualChanged = Number(before.priceAnnual) !== Number(after.priceAnnual);
  if (!nameChanged && !monthlyChanged && !annualChanged) return;

  const stripe = getStripe(STRIPE_SECRET_KEY.value());
  const planId = event.params.planId;

  try {
    if (nameChanged) {
      await stripe.products.update(after.stripeProductId, { name: after.name });
      logger.info(`Plan ${planId}: nombre sincronizado a Stripe ("${after.name}")`);
    }

    const updates = {};

    // priceAnnual se guarda como equivalente mensual (lo que se muestra al usuario); el Price de
    // Stripe con intervalo anual cobra el importe del año completo, de ahí el ×12.
    const priceChanges = [
      { changed: monthlyChanged, amount: after.priceMonthly, interval: 'month', field: 'stripePriceIdMonthly', multiplier: 1, label: 'mensual' },
      { changed: annualChanged, amount: after.priceAnnual, interval: 'year', field: 'stripePriceIdAnnual', multiplier: 12, label: 'anual' }
    ];

    for (const { changed, amount, interval, field, multiplier, label } of priceChanges) {
      if (!changed || !(Number(amount) > 0)) continue;

      const newPrice = await stripe.prices.create({
        product: after.stripeProductId,
        currency: 'eur',
        unit_amount: Math.round(Number(amount) * multiplier * 100),
        recurring: { interval },
        tax_behavior: 'inclusive'
      });

      const oldPriceId = after[field];
      if (oldPriceId) {
        await stripe.prices.update(oldPriceId, { active: false }).catch((err) =>
          logger.warn(`Plan ${planId}: no se pudo archivar el precio ${label} antiguo (${oldPriceId})`, err)
        );
      }

      updates[field] = newPrice.id;
      logger.info(`Plan ${planId}: nuevo precio ${label} en Stripe (${newPrice.id})`);
    }

    if (Object.keys(updates).length > 0) {
      await event.data.after.ref.update(updates);
    }
  } catch (err) {
    logger.error(`Error sincronizando el plan ${planId} con Stripe`, err);
  }
});
