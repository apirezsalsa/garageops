// --- CHANGELOG DE CARA AL USUARIO ---
// Orden cronológico ascendente (el más nuevo al final). Solo se listan aquí cambios que el
// usuario puede notar y usar (funciones nuevas, arreglos visibles) — nunca refactors internos,
// cambios de tamaño de fuente aislados, etc. Cada vez que se despliegue algo relevante para el
// usuario, añade una entrada nueva al final con la versión y la fecha de despliegue.
export const APP_VERSION = '1.1.0';

export const CHANGELOG = [
  {
    version: '1.1.0',
    date: '2026-08-16',
    changes: {
      es: [
        'Adjunta fotos del ticket o factura a cada mantenimiento, con galería para verlas todas.',
        'Registra varias piezas por mantenimiento, con nº de referencia para saber qué comprar la próxima vez.',
        'Activa o desactiva el aviso de stock bajo repuesto por repuesto (útil para tornillos, no tanto para aceite).',
        'Notificaciones push y alertas por fecha, además de por kilómetros/horas.',
        'Mejoras de uso en móvil: listas más claras y fáciles de tocar.',
      ],
      en: [
        'Attach ticket/invoice photos to each maintenance record, with a gallery to view them all.',
        'Log multiple parts per maintenance, with part number so you know what to buy next time.',
        'Toggle low-stock alerts per part (handy for bolts, less so for oil).',
        'Push notifications and date-based alerts, in addition to mileage/hours.',
        'Mobile usability improvements: clearer, easier-to-tap lists.',
      ],
      it: [
        'Allega foto dello scontrino/fattura a ogni manutenzione, con galleria per vederle tutte.',
        'Registra più ricambi per manutenzione, con numero di riferimento per sapere cosa comprare la prossima volta.',
        'Attiva o disattiva l\'avviso di scorta bassa per ogni ricambio (utile per le viti, meno per l\'olio).',
        'Notifiche push e avvisi per data, oltre che per km/ore.',
        'Miglioramenti dell\'usabilità mobile: liste più chiare e facili da toccare.',
      ],
      fr: [
        'Ajoutez des photos du ticket/facture à chaque entretien, avec une galerie pour toutes les voir.',
        'Enregistrez plusieurs pièces par entretien, avec référence pour savoir quoi racheter la prochaine fois.',
        'Activez ou désactivez l\'alerte de stock bas pièce par pièce (utile pour les boulons, moins pour l\'huile).',
        'Notifications push et alertes par date, en plus du kilométrage/heures.',
        'Améliorations mobiles : listes plus claires et plus faciles à toucher.',
      ],
      de: [
        'Füge jeder Wartung Foto(s) des Kassenbons/der Rechnung hinzu, mit Galerie für alle Bilder.',
        'Erfasse mehrere Teile pro Wartung, mit Teilenummer, damit du beim nächsten Mal genau weißt, was zu kaufen ist.',
        'Warnung bei niedrigem Bestand pro Teil ein-/ausschalten (praktisch für Schrauben, weniger für Öl).',
        'Push-Benachrichtigungen und Termin-Erinnerungen, zusätzlich zu Kilometer-/Stundenalarmen.',
        'Verbesserte mobile Bedienung: klarere, leichter antippbare Listen.',
      ],
      pt: [
        'Anexe fotos do talão/fatura a cada manutenção, com galeria para ver todas.',
        'Registe várias peças por manutenção, com número de referência para saber o que comprar da próxima vez.',
        'Ative ou desative o aviso de stock baixo peça a peça (útil para parafusos, menos para óleo).',
        'Notificações push e alertas por data, além de por quilómetros/horas.',
        'Melhorias de usabilidade em telemóvel: listas mais claras e fáceis de tocar.',
      ],
    },
  },
];
