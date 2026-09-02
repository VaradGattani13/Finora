// Fixed category set — used by dropdown, colors, PDF export.
// To add/rename, edit here + re-deploy.

export type Category = {
  id: string;
  label: string;
  color: string;    // light-mode color
  colorDark: string; // dark-mode color
};

export const CATEGORIES: Category[] = [
  { id: 'travel',   label: 'Travel',                              color: '#2a78d6', colorDark: '#3987e5' },
  { id: 'grocery',  label: 'Grocery / Essentials',                color: '#eb6834', colorDark: '#d95926' },
  { id: 'rent',     label: 'Rent',                                color: '#1baf7a', colorDark: '#199e70' },
  { id: 'bills',    label: 'Bills',                               color: '#eda100', colorDark: '#c98500' },
  { id: 'shopping', label: 'Shopping',                            color: '#e87ba4', colorDark: '#d55181' },
  { id: 'misc',     label: 'Miscellaneous',                       color: '#8b6f4e', colorDark: '#b0906a' },
  { id: 'credit',   label: 'Credit Cards',                        color: '#008300', colorDark: '#008300' },
  { id: 'food',     label: 'Food (Swiggy/Zomato/Outside)',        color: '#4a3aa7', colorDark: '#9085e9' },
  { id: 'invest',   label: 'Investment',                          color: '#e34948', colorDark: '#e66767' },
];

export const CAT_BY_ID: Record<string, Category> = Object.fromEntries(
  CATEGORIES.map((c) => [c.id, c])
);

export const isValidCategoryId = (id: string | null | undefined): id is string =>
  !!id && CAT_BY_ID[id] !== undefined;
