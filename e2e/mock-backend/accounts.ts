/** Comptes SYNTHÉTIQUES du faux backend (domaine réservé `example.test`) et codes acceptés. */
export const ADMIN_ACCOUNTS = {
  owner: 'admin@example.test',
  newOwner: 'nouvel.admin@example.test',
  support: 'support@example.test',
  analyst: 'analyste@example.test',
  moderator: 'moderation@example.test',
  notAdmin: 'coureur@example.test',
} as const;

export const MOCK_OTP_CODE = '123456';
export const MOCK_TOTP_CODE = '123456';
export const MOCK_PORT = 54329;
