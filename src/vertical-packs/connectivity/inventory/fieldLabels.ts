/**
 * Connectivity Pack — form field labels for inventory forms.
 *
 * Consumers pass this map explicitly to `showFormErrors(errors, { fieldLabels })`.
 * The Core generic label map does not know these keys.
 */
export const CONNECTIVITY_INVENTORY_FIELD_LABELS: Record<string, string> = {
  router_factory: 'Dados de fábrica do roteador',
  sim_card_factory: 'Dados do chip',
  'router_factory.ssid_factory': 'SSID de fábrica',
  'router_factory.wifi_password_factory': 'Senha Wi-Fi de fábrica',
  'router_factory.admin_user': 'Usuário admin',
  'router_factory.admin_password': 'Senha admin',
  'router_factory.imei': 'IMEI',
  'sim_card_factory.iccid': 'ICCID',
  'sim_card_factory.line_number': 'Número da linha',
  'sim_card_factory.carrier': 'Operadora',
  'sim_card_factory.apn': 'APN',
  'sim_card_factory.pin': 'PIN',
};
