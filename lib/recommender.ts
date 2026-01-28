import type { Restaurant, Slots, Profile, RestaurantRecommendation } from "@/types";
import { RESTAURANTS } from "./restaurants";

/**
 * Map slot budget to restaurant price format
 */
function mapBudgetToPrice(budget: "cheap" | "mid" | "high"): "low" | "mid" | "high" {
  return budget === "cheap" ? "low" : budget;
}

/**
 * Filter restaurants by slots and profile
 */
function filterRestaurants(slots: Slots, profile: Profile): Restaurant[] {
  let filtered = [...RESTAURANTS];

  // Filter by area
  if (slots.area) {
    filtered = filtered.filter(
      (r) =>
        r.area.toLowerCase().includes(slots.area!.toLowerCase()) ||
        slots.area!.toLowerCase().includes(r.area.toLowerCase())
    );
  }

  // Filter by budget (strict filter) - only if explicitly provided by user
  if (slots.budget) {
    const price = mapBudgetToPrice(slots.budget);
    filtered = filtered.filter((r) => r.price === price);
  }

  // Filter by dietary requirements
  if (slots.dietary && slots.dietary.length > 0) {
    filtered = filtered.filter((r) => {
      return slots.dietary!.some((req) =>
        r.dietary.some((d) => d.toLowerCase().includes(req.toLowerCase()))
      );
    });
  }

  // Filter out avoided cuisines
  if (slots.avoid?.cuisines && slots.avoid.cuisines.length > 0) {
    filtered = filtered.filter((r) => {
      return !slots.avoid!.cuisines!.some((avoidCuisine) =>
        r.cuisines.some((c) => c.toLowerCase().includes(avoidCuisine.toLowerCase()))
      );
    });
  }

  // Filter out avoided tags
  if (slots.avoid?.tags && slots.avoid.tags.length > 0) {
    filtered = filtered.filter((r) => {
      return !slots.avoid!.tags!.some((avoidTag) =>
        r.vibe.some((v) => v.toLowerCase().includes(avoidTag.toLowerCase())) ||
        r.highlights.some((h) => h.toLowerCase().includes(avoidTag.toLowerCase()))
      );
    });
  }

  return filtered;
}

/**
 * Score a restaurant based on slots and profile
 */
function scoreRestaurant(restaurant: Restaurant, slots: Slots, profile: Profile): number {
  let score = 0;

  // Cuisine match (+3 per match)
  if (slots.cravingCuisines && slots.cravingCuisines.length > 0) {
    const cuisineMatches = slots.cravingCuisines.filter((c) =>
      restaurant.cuisines.some(
        (rc) =>
          rc.toLowerCase().includes(c.toLowerCase()) ||
          c.toLowerCase().includes(rc.toLowerCase())
      )
    );
    score += cuisineMatches.length * 3;
  }

  // Vibe match (+2 per match)
  if (slots.vibe) {
    const vibeMatch = restaurant.vibe.some((v) => {
      const vibeMap: Record<string, string[]> = {
        romantic: ["romantic", "intimate", "elegant"],
        lively: ["lively", "casual", "fun"],
        quiet: ["quiet", "peaceful", "calm"],
        outdoor: ["outdoor", "patio", "garden"],
        family: ["family-friendly", "family"],
        business: ["business", "professional", "upscale"],
      };
      const matches = vibeMap[slots.vibe] || [];
      return matches.some((m) => v.toLowerCase().includes(m.toLowerCase()));
    });
    if (vibeMatch) {
      score += 2;
    }
  }

  // Budget match (+1) - only if explicitly provided by user
  if (slots.budget) {
    const price = mapBudgetToPrice(slots.budget);
    if (restaurant.price === price) {
      score += 1;
    }
  }

  // Dietary match (+1 per match)
  if (slots.dietary && slots.dietary.length > 0) {
    const dietaryMatches = slots.dietary.filter((d) =>
      restaurant.dietary.some((rd) => rd.toLowerCase().includes(d.toLowerCase()))
    );
    score += dietaryMatches.length;
  }

  // Profile cuisine boosts (novelty +0.5 per like)
  if (slots.cravingCuisines) {
    for (const cuisine of slots.cravingCuisines) {
      const likeScore = profile.cuisinesLiked[cuisine] || 0;
      score += likeScore * 0.5;
    }
  }

  // Profile vibe boosts
  if (slots.vibe) {
    const vibeScore = profile.vibePrefs[slots.vibe] || 0;
    score += vibeScore * 0.5;
  }

  // Rating boost (multiply by 0.5, so 4.5 rating = +2.25)
  score += restaurant.rating * 0.5;

  return score;
}

/**
 * Diversify recommendations (avoid repeating same top pick)
 */
function diversifyRecommendations(
  scored: Array<{ restaurant: Restaurant; score: number }>,
  previousTopPickIds?: string[]
): Array<{ restaurant: Restaurant; score: number }> {
  if (!previousTopPickIds || previousTopPickIds.length === 0) {
    return scored;
  }

  // Move previous top picks down in ranking (reduce score by 50% each time they appear)
  const diversified = scored.map((item) => {
    if (previousTopPickIds.includes(item.restaurant.id)) {
      // Reduce score significantly to push it down
      return { ...item, score: item.score * 0.3 }; // Reduce score by 70%
    }
    return item;
  });

  // Re-sort by new scores
  return diversified.sort((a, b) => b.score - a.score);
}

/**
 * Generate reasons for recommending a restaurant
 */
function generateReasons(restaurant: Restaurant, slots: Slots, profile: Profile): string[] {
  const reasons: string[] = [];

  // Cuisine match
  if (slots.cravingCuisines && slots.cravingCuisines.length > 0) {
    const matches = slots.cravingCuisines.filter((c) =>
      restaurant.cuisines.some(
        (rc) =>
          rc.toLowerCase().includes(c.toLowerCase()) ||
          c.toLowerCase().includes(rc.toLowerCase())
      )
    );
    if (matches.length > 0) {
      reasons.push(`great ${matches.join(" and ")} cuisine`);
    }
  }

  // Vibe match
  if (slots.vibe) {
    const vibeMatch = restaurant.vibe.some((v) => {
      const vibeMap: Record<string, string[]> = {
        romantic: ["romantic", "intimate", "elegant"],
        lively: ["lively", "casual", "fun"],
        quiet: ["quiet", "peaceful", "calm"],
        outdoor: ["outdoor", "patio", "garden"],
        family: ["family-friendly", "family"],
        business: ["business", "professional", "upscale"],
      };
      const matches = vibeMap[slots.vibe] || [];
      return matches.some((m) => v.toLowerCase().includes(m.toLowerCase()));
    });
    if (vibeMatch) {
      reasons.push(`perfect ${slots.vibe} vibe`);
    }
  }

  // Budget match
  if (slots.budget) {
    const price = mapBudgetToPrice(slots.budget);
    if (restaurant.price === price) {
      reasons.push(`matches your ${slots.budget} budget`);
    }
  }

  // Rating
  if (restaurant.rating >= 4.5) {
    reasons.push(`highly rated (${restaurant.rating} stars)`);
  }

  // Highlights
  if (restaurant.highlights.length > 0) {
    reasons.push(restaurant.highlights[0]);
  }

  return reasons.slice(0, 3); // Max 3 reasons
}

/**
 * Recommend restaurants based on slots and profile
 */
export function recommendRestaurants(
  slots: Slots,
  profile: Profile,
  previousTopPickIds?: string[]
): {
  topPick: RestaurantRecommendation;
  alternatives: RestaurantRecommendation[];
} {
  // Filter restaurants
  const filtered = filterRestaurants(slots, profile);

  if (filtered.length === 0) {
    // Fallback: use all restaurants if filtered is empty
    const allScored = RESTAURANTS.map((r) => ({
      restaurant: r,
      score: scoreRestaurant(r, slots, profile),
    }));
    allScored.sort((a, b) => b.score - a.score);
    const top = allScored[0];
    return {
      topPick: {
        restaurant: top.restaurant,
        reasons: generateReasons(top.restaurant, slots, profile),
      },
      alternatives: [],
    };
  }

  // Score restaurants
  const scored = filtered.map((r) => ({
    restaurant: r,
    score: scoreRestaurant(r, slots, profile),
  }));

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  // Diversify if needed
  const diversified = diversifyRecommendations(scored, previousTopPickIds);

  // Get top pick
  const top = diversified[0];
  const topPick: RestaurantRecommendation = {
    restaurant: top.restaurant,
    reasons: generateReasons(top.restaurant, slots, profile),
  };

  // Get alternatives (1-2 more, avoiding duplicates)
  const alternatives: RestaurantRecommendation[] = [];
  for (let i = 1; i < diversified.length && alternatives.length < 2; i++) {
    const alt = diversified[i];
    alternatives.push({
      restaurant: alt.restaurant,
      reasons: generateReasons(alt.restaurant, slots, profile),
    });
  }

  return { topPick, alternatives };
}
