import { getAdminOutfitRubric } from '../adminRubric';

describe('admin outfit rubric', () => {
  const original = process.env.ADMIN_OUTFIT_RUBRIC;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.ADMIN_OUTFIT_RUBRIC;
    } else {
      process.env.ADMIN_OUTFIT_RUBRIC = original;
    }
  });

  it('returns default rubric when no override is set', () => {
    delete process.env.ADMIN_OUTFIT_RUBRIC;
    const rubric = getAdminOutfitRubric();
    expect(rubric).toContain('Admin Outfit Judging Rubric');
    expect(rubric).toContain('Silhouette & Proportion (0–3 points)');
    expect(rubric).toContain('The total possible score is 12 points');
  });

  it('uses ADMIN_OUTFIT_RUBRIC environment override when present', () => {
    process.env.ADMIN_OUTFIT_RUBRIC = 'Custom rubric goes here';
    const rubric = getAdminOutfitRubric();
    expect(rubric).toBe('Custom rubric goes here');
  });
});


