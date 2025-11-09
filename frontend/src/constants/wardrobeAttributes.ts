const formatOptionLabel = (value: string): string => {
  return value
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

const buildOptions = (values: string[]) =>
  values.map(value => ({
    value,
    label: formatOptionLabel(value),
  }));

export const COLOR_OPTIONS = buildOptions([
  'black',
  'white',
  'gray',
  'navy',
  'blue',
  'green',
  'olive',
  'red',
  'burgundy',
  'pink',
  'purple',
  'yellow',
  'orange',
  'brown',
  'tan',
  'beige',
  'cream',
  'metallic',
  'multicolor',
  'other',
]);

export const FABRIC_OPTIONS = buildOptions([
  'cotton',
  'linen',
  'silk',
  'wool',
  'cashmere',
  'denim',
  'leather',
  'suede',
  'knit',
  'synthetic',
  'chiffon',
  'satin',
  'velvet',
  'lace',
  'other',
]);

export const PATTERN_OPTIONS = buildOptions([
  'solid',
  'striped',
  'plaid',
  'check',
  'floral',
  'animal',
  'polka-dot',
  'geometric',
  'graphic',
  'abstract',
  'textured',
  'other',
]);

export const SILHOUETTE_OPTIONS = buildOptions([
  'a-line',
  'column',
  'fit-and-flare',
  'cocoon',
  'trapeze',
  'bodycon',
  'wide-leg',
  'straight-leg',
  'cropped',
  'long-sleeve',
  'short-sleeve',
  'sleeveless',
  'peplum',
  'asymmetrical-hem',
  'v-neck',
  'boat-neck',
  'mock-neck',
  'turtleneck',
  'crew-neck',
  'scoop-neck',
  'square-neck',
  'sweetheart',
  'off-the-shoulder',
  'halter-neck',
  'cowl-neck',
  'hooded',
  'collared',
  'collarless',
  'other',
]);

export const FIT_OPTIONS = buildOptions([
  'second-skin',
  'slim',
  'regular',
  'relaxed',
  'oversized',
  'tailored',
  'other',
]);

export const FORMALITY_OPTIONS = buildOptions([
  'casual',
  'smart-casual',
  'business-casual',
  'business-formal',
  'evening',
  'formal',
  'athleisure',
  'other',
]);

export const STYLE_TAG_OPTIONS = buildOptions([
  'minimalist',
  'classic',
  'modern',
  'trendy',
  'edgy',
  'boho',
  'preppy',
  'athleisure',
  'streetwear',
  'romantic',
  'feminine',
  'androgynous',
  'workwear',
  'vintage',
  'sporty',
  'heritage',
  'other',
]);

export const SEASON_OPTIONS = buildOptions([
  'spring',
  'summer',
  'fall',
  'winter',
  'all-season',
]);

export const OCCASION_OPTIONS = buildOptions([
  'work',
  'weekend',
  'date',
  'family',
  'travel',
  'party',
  'formal-event',
  'outdoor',
  'athletic',
  'lounging',
  'wedding',
  'other',
]);

export const BRAND_OPTIONS = [
  'Rick Owens',
  'Maison Margiela',
  'Ann Demeulemeester',
  'Yohji Yamamoto',
  'Comme des Garçons',
  'Issey Miyake',
  'Junya Watanabe',
  'Acne Studios',
  'Helmut Lang',
  'Raf Simons',
  'Dries Van Noten',
  'Balenciaga',
  'Vetements',
  'Dion Lee',
  'Peter Do',
  'The Row',
  'Celine',
  'Loewe',
  'Bottega Veneta',
  'Prada',
  'Miu Miu',
  'Saint Laurent',
  'Gucci',
  'Dior',
  'Chanel',
  'Versace',
  'Fendi',
  'Givenchy',
  'Jil Sander',
  'Marni',
  'Stella McCartney',
  'Vivienne Westwood',
  'Alexander McQueen',
  'Banana Republic',
  'Camper',
  'Professor E',
  'Zara',
  'H&M',
  'COS',
  'Arket',
  'Everlane',
  'Cuyana',
  'Reformation',
  'Aritzia',
  'Ganni',
  'Staud',
  'Nanushka',
  'Totême',
  'Vintage',
  'Thrift',
  'Jean Paul Gaultier',
  'Deadwood',
  'Stussy',
  'Moschino',
  'Other',
].map(value => ({
  value,
  label: value,
}));

