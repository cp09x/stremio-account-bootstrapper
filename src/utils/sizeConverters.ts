export const convertToBytes = (gb: string | number) => {
  const value = Number(gb);
  if (Number.isNaN(value)) return 0;
  return value * 1024 * 1024 * 1024;
};

export const convertToMegabytes = (gb: string | number) => {
  const value = Number(gb);
  if (Number.isNaN(value)) return 0;
  return value * 1024;
};
