const DEFAULT_ADMIN_OUTFIT_RUBRIC = `
Admin Outfit Judging Rubric
===========================

When judging an outfit, assign points in each of the following categories. The total possible score is 12 points. Provide brief reasoning for each category and a final summary.  

Also include a confidence score from 1–10, representing how confident you are in your evaluation.  

---

1. Silhouette & Proportion (0–3 points)
What to look for: Assess the overall shape and balance of the outfit. A good silhouette creates visual harmony — balancing fitted and loose elements, highlighting or intentionally obscuring body shape, and avoiding visual heaviness. Proportion should feel purposeful, not random. Layering tops is only okay if intentioinal - if they have different necklines or sleeve lengths so something interesting is visible in each item. Same with bottoms - typically only short skirts and pants work as a layer, nothing else really works in terms of layering bottoms.
3 points: The outfit has a clear structure and balanced proportions — one focal volume (e.g., fitted top + wide pants, or oversized outer layer + slim base).  
2 points: Mostly cohesive but slightly off — proportions feel a little unbalanced or undefined.  
1 point: Bulky, shapeless, or flat — lacks a clear proportion or intentional structure.  
0 points: Conflicting silhouettes or poor layering (for example, multiple oversized pieces or clashing shapes).  
Tip: Maintain one focal volume. Contrast soft/fluid with structured/sharp. Show shape at least once (waist, hem, or neckline).

---

2. Color Harmony (0–3 points)
What to look for: Evaluate how well the colors and patterns relate. Strong color coordination follows basic color theory — complementary (opposites on the color wheel) create contrast, analogous (neighbors) create cohesion, and monochrome schemes feel minimal and elegant. Undertones (warm vs. cool) should align, and saturation levels should feel balanced.
Patterns should feel intentional, not chaotic. Multiple patterns can work together if they share a base color, scale, or visual rhythm. Avoid pairing loud or busy prints that compete for attention.
3 points: Palette is intentional and balanced — complementary, analogous, or monochrome with clear contrast.  
2 points: Mostly cohesive but slightly tense (undertones or saturation slightly off).  
1 point: Mismatched undertones or competing bright tones.  
0 points: Random or muddy palette — no dominant base color.  
Tip: Use one dominant color plus one or two accents. Keep undertones consistent (cool vs. warm). Use neutrals to anchor bold colors.

---

3. Texture & Fabric Pairing (0–2 points)
What to look for: Good outfits combine different textures to add depth and visual interest. Contrast soft with structured, matte with shiny, or smooth with rough. Textures should enhance the silhouette and mood, not compete for attention.
2 points: Textures and fabrics balance each other — contrast harmoniously (matte + sheen, soft + structured).  
1 point: Textures are too similar or slightly mismatched in weight or finish.  
0 points: Fabrics clash or feel unintentional (e.g., heavy knit with sheer silk).  
Tip: Mix textures purposefully; don’t combine materials that fight visually or conceptually.

---

4. Accessories & Styling (0–2 points)
What to look for: Accessories should frame and enhance the outfit, not overwhelm it. They should match the outfit’s tone, formality, and aesthetic direction (e.g., minimalist jewelry for sleek looks, sculptural pieces for avant-garde). Styling choices like hair, makeup, and layering also count.
2 points: Accessories enhance the outfit — balanced in scale, tone, and formality.  
1 point: Slight mismatch or overuse (one extra statement piece or clashing metal tone).  
0 points: Over-accessorized or irrelevant (multiple statement pieces, two bags, or mismatched tones).  
Tip: One hero accessory maximum. Match formality and finish. Avoid redundancy or confusion.

---

5. Context & Formality (0–2 points)
What to look for: The outfit should make sense for the stated occasion, setting, and season. Formality levels must align (no beachwear at dinner, no heels for a hike). Even creative styling must feel plausible within its context.
2 points: Outfit matches the stated occasion and season.  
1 point: Slight mismatch (e.g., too casual for event or slightly wrong-season fabric).  
0 points: Fundamentally inappropriate for the context.  
Tip: Style only works if the context is believable — formality and setting must align with intent.

Automatic Deductions (-2 points each if applicable):
- Swimwear used outside a beach, pool, lake, or water-related context.  
- Sleepwear used outside home, lounging, or sleepover context.  
- Athletic wear used at formal or evening events.  
- Conflicting outer layers (for example, wearing a cape and a blazer together).  
- Two or more bags in one outfit.

---

Scoring Guide
10–12 points: Excellent — cohesive, stylish, intentional.  
7–9 points: Good — wearable and harmonious with minor flaws.  
4–6 points: Uneven — has potential but lacks polish or logic.  
0–3 points: Poor — incoherent, clashing, or contextually wrong.

---

Output Format
When returning your evaluation, provide:
1. Total score (out of 12, after deductions)  
2. Confidence score (1–10)  
3. Brief feedback: Highlight key strengths and flaws in 3–4 sentences.  
4. Flags (if any): List rule violations or automatic deductions triggered.  


Verdict mapping:
- "like"     : The outfit is training-worthy and exemplifies good styling for the context.
- "dislike"  : The outfit should be rejected (explain why).
- "neutral"  : Borderline cases that need human review.

When scoring, consider:
- Core balance — top, bottom, shoes, accessories all purposeful, with layering intentional.
- Cohesion — color story, textures, silhouette harmony, anchor piece highlighted.
- Context alignment — matches prompt, season, formality, and feedback notes.
- Practicality — wearable for the stated scenario (weather-appropriate, mobility, comfort).
- Originality — inventive combinations still grounded in the prompt and rubric standards.

Prepare a concise rationale summarizing the key drivers behind the score (references to items, fit, color, and context).
`.trim();

export function getAdminOutfitRubric(): string {
  const envRubric = process.env.ADMIN_OUTFIT_RUBRIC;
  if (envRubric && envRubric.trim().length > 0) {
    return envRubric.trim();
  }
  return DEFAULT_ADMIN_OUTFIT_RUBRIC;
}


