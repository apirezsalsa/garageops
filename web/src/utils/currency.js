// Moneda de visualización para los importes que el usuario introduce (mantenimientos, repuestos).
// No hace conversión de cambio: es solo qué símbolo se muestra. Ver [[project_currency_selector]]
// en memoria — un registro ya guardado conserva el símbolo con el que se creó; cambiar la moneda
// aquí solo afecta a lo que se registre a partir de ahora.
export const CURRENCIES = [
  { code: 'EUR', symbol: '€', label: 'Euro (€)' },
  { code: 'USD', symbol: '$', label: 'Dólar estadounidense ($)' },
  { code: 'GBP', symbol: '£', label: 'Libra esterlina (£)' },
  { code: 'MXN', symbol: '$', label: 'Peso mexicano ($)' },
  { code: 'ARS', symbol: '$', label: 'Peso argentino ($)' },
  { code: 'COP', symbol: '$', label: 'Peso colombiano ($)' },
  { code: 'CLP', symbol: '$', label: 'Peso chileno ($)' },
  { code: 'UYU', symbol: '$', label: 'Peso uruguayo ($)' },
  { code: 'BRL', symbol: 'R$', label: 'Real brasileño (R$)' },
  { code: 'CAD', symbol: '$', label: 'Dólar canadiense ($)' },
  { code: 'AUD', symbol: '$', label: 'Dólar australiano ($)' },
  { code: 'CHF', symbol: 'Fr', label: 'Franco suizo (Fr)' },
];

export const DEFAULT_CURRENCY = 'EUR';

export function getCurrencySymbol(code) {
  return CURRENCIES.find(c => c.code === code)?.symbol || '€';
}
