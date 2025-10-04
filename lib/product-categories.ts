export const CELL_PHONE_NEW_CATEGORY = "Celulares Nuevos";
export const CELL_PHONE_USED_CATEGORY = "Celulares Usados";
export const CELL_PHONE_GENERIC_CATEGORY = "Celulares";

export const isPhoneCategory = (category?: string | null) =>
  category === CELL_PHONE_GENERIC_CATEGORY ||
  category === CELL_PHONE_NEW_CATEGORY ||
  category === CELL_PHONE_USED_CATEGORY;

export const isPhoneWithMandatoryDeletion = (category?: string | null) =>
  category === CELL_PHONE_NEW_CATEGORY || category === CELL_PHONE_USED_CATEGORY;
