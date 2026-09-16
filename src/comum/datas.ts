/** Datas de negócio no fuso do escritório (America/Cuiaba), compartilhadas por locações, comissões e pessoas. */
export const DATA_ATUAL_SQL = "(CURRENT_TIMESTAMP AT TIME ZONE 'America/Cuiaba')::date";
export const hojeCivil = (): string => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Cuiaba', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
