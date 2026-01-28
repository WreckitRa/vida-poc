import type { Restaurant, ActiveRequest } from "@/types";
import { RESTAURANTS } from "./restaurants";

/**
 * Get top 3 restaurants based on activeRequest
 */
export function getTopRestaurants(
  activeRequest: ActiveRequest
): { top: Restaurant; alternatives: Restaurant[] } {
  // Filter by area (required)
  let filtered = RESTAURANTS.filter((r) => {
    if (!activeRequest.area) return false;
    return (
      r.area.toLowerCase().includes(activeRequest.area.toLowerCase()) ||
      activeRequest.area.toLowerCase().includes(r.area.toLowerCase())
    );
  });

  if (filtered.length === 0) {
    // Fallback: if no area match, return top rated restaurants
    filtered = [...RESTAURANTS].sort((a, b) => b.rating - a.rating).slice(0, 3);
    return {
      top: filtered[0],
      alternatives: filtered.slice(1, 3),
    };
  }

  // Score restaurants
  const scored = filtered.map((restaurant) => {
    let score = 0;

    // Exact cuisine match (+10)
    if (activeRequest.cuisine) {
      const cuisineLower = activeRequest.cuisine.toLowerCase();
      const hasMatch = restaurant.cuisines.some(
        (c) => c.toLowerCase() === cuisineLower || c.toLowerCase().includes(cuisineLower) || cuisineLower.includes(c.toLowerCase())
      );
      if (hasMatch) {
        score += 10;
      }
    }

    // Budget match: exact (+5), +/-1 range (+2)
    if (activeRequest.budget) {
      const budgetMap: Record<1 | 2 | 3 | 4, "low" | "mid" | "high"> = {
        1: "low",
        2: "mid",
        3: "high",
        4: "high",
      };
      const targetPrice = budgetMap[activeRequest.budget.range];
      const priceMap: Record<"low" | "mid" | "high", number> = {
        low: 1,
        mid: 2,
        high: 3,
      };
      const restaurantPriceNum = priceMap[restaurant.price];
      const targetPriceNum = priceMap[targetPrice];
      
      if (restaurant.price === targetPrice) {
        score += 5; // Exact match
      } else if (Math.abs(restaurantPriceNum - targetPriceNum) === 1) {
        score += 2; // Within 1 range
      }
    }

    // Tag matches from notes (romantic, lively, quiet, family, rooftop, view)
    if (activeRequest.notes) {
      const notesLower = activeRequest.notes.toLowerCase();
      const tags = ["romantic", "lively", "quiet", "family", "rooftop", "view"];
      tags.forEach((tag) => {
        if (notesLower.includes(tag)) {
          const hasMatch = restaurant.vibe.some((v) => v.toLowerCase().includes(tag)) ||
            restaurant.highlights.some((h) => h.toLowerCase().includes(tag));
          if (hasMatch) {
            score += 3;
          }
        }
      });
    }

    // Rating boost
    score += restaurant.rating * 0.5;

    return { restaurant, score };
  });

  // Sort by score
  scored.sort((a, b) => b.score - a.score);

  const top = scored[0].restaurant;
  const alternatives = scored.slice(1, 3).map((s) => s.restaurant);

  return { top, alternatives };
}

/**
 * Generate short reasons for recommending a restaurant
 */
export function generateReasons(restaurant: Restaurant, activeRequest: ActiveRequest): string[] {
  const reasons: string[] = [];

  if (activeRequest.cuisine) {
    const cuisineLower = activeRequest.cuisine.toLowerCase();
    const hasCuisineMatch = restaurant.cuisines.some(
      (c) => c.toLowerCase() === cuisineLower || c.toLowerCase().includes(cuisineLower)
    );
    if (hasCuisineMatch) {
      reasons.push(`Great ${activeRequest.cuisine} cuisine`);
    }
  }

  if (restaurant.rating >= 4.5) {
    reasons.push(`Highly rated`);
  }

  if (restaurant.highlights.length > 0) {
    reasons.push(restaurant.highlights[0]);
  }

  return reasons.slice(0, 3);
}
