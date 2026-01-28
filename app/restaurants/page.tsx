"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { RESTAURANTS } from "@/lib/restaurants";
import type { Restaurant } from "@/types";

export default function RestaurantsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCuisine, setSelectedCuisine] = useState<string>("");
  const [selectedPrice, setSelectedPrice] = useState<string>("");
  const [selectedCity, setSelectedCity] = useState<string>("");
  const [selectedRestaurant, setSelectedRestaurant] = useState<Restaurant | null>(null);

  // Get unique values for dropdowns
  const uniqueCuisines = useMemo(() => {
    const cuisines = new Set<string>();
    RESTAURANTS.forEach((r) => r.cuisines.forEach((c) => cuisines.add(c)));
    return Array.from(cuisines).sort();
  }, []);

  const uniqueCities = useMemo(() => {
    const cities = new Set<string>();
    RESTAURANTS.forEach((r) => cities.add(r.city));
    return Array.from(cities).sort();
  }, []);

  // Filter restaurants
  const filteredRestaurants = useMemo(() => {
    return RESTAURANTS.filter((restaurant) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          restaurant.name.toLowerCase().includes(query) ||
          restaurant.cuisines.some((c) => c.toLowerCase().includes(query)) ||
          restaurant.vibe.some((v) => v.toLowerCase().includes(query)) ||
          restaurant.area.toLowerCase().includes(query);
        if (!matchesSearch) return false;
      }

      // Cuisine filter
      if (selectedCuisine && !restaurant.cuisines.includes(selectedCuisine)) {
        return false;
      }

      // Price filter
      if (selectedPrice && restaurant.price !== selectedPrice) {
        return false;
      }

      // City filter
      if (selectedCity && restaurant.city !== selectedCity) {
        return false;
      }

      return true;
    });
  }, [searchQuery, selectedCuisine, selectedPrice, selectedCity]);

  const clearFilters = () => {
    setSearchQuery("");
    setSelectedCuisine("");
    setSelectedPrice("");
    setSelectedCity("");
  };

  const hasActiveFilters = searchQuery || selectedCuisine || selectedPrice || selectedCity;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-7xl mx-auto flex gap-4">
          <Link href="/" className="text-gray-700 hover:text-blue-600 transition-colors">
            Home
          </Link>
          <Link href="/chat" className="text-gray-700 hover:text-blue-600 transition-colors">
            Chat
          </Link>
          <Link href="/restaurants" className="text-blue-600 font-semibold">
            Restaurants
          </Link>
          <Link href="/insights" className="text-gray-700 hover:text-blue-600 transition-colors">
            Insights
          </Link>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <h1 className="text-3xl font-bold text-gray-800 mb-6">Restaurants</h1>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            {/* Search Input */}
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Search name, cuisine, vibe, area..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-4 py-3 bg-white rounded-lg border border-gray-300 text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#25D366]/50"
              />
            </div>

            {/* Cuisine Dropdown */}
            <div>
              <select
                value={selectedCuisine}
                onChange={(e) => setSelectedCuisine(e.target.value)}
                className="w-full px-4 py-3 bg-white rounded-lg border border-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#25D366]/50"
              >
                <option value="">All Cuisines</option>
                {uniqueCuisines.map((cuisine) => (
                  <option key={cuisine} value={cuisine}>
                    {cuisine}
                  </option>
                ))}
              </select>
            </div>

            {/* Price Dropdown */}
            <div>
              <select
                value={selectedPrice}
                onChange={(e) => setSelectedPrice(e.target.value)}
                className="w-full px-4 py-3 bg-white rounded-lg border border-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#25D366]/50"
              >
                <option value="">All Prices</option>
                <option value="low">Low</option>
                <option value="mid">Mid</option>
                <option value="high">High</option>
              </select>
            </div>

            {/* City Dropdown */}
            <div>
              <select
                value={selectedCity}
                onChange={(e) => setSelectedCity(e.target.value)}
                className="w-full px-4 py-3 bg-white rounded-lg border border-gray-300 text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#25D366]/50"
              >
                <option value="">All Cities</option>
                {uniqueCities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <div className="mt-4 flex items-center justify-between">
              <button
                onClick={clearFilters}
                className="px-4 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
              <div className="text-sm text-gray-600">
                Showing <span className="font-medium">{filteredRestaurants.length}</span> of <span className="font-medium">{RESTAURANTS.length}</span> restaurants
              </div>
            </div>
          )}

          {!hasActiveFilters && (
            <div className="mt-4 text-sm text-gray-600">
              Showing <span className="font-medium">{filteredRestaurants.length}</span> restaurants
            </div>
          )}
        </div>

        {/* Restaurant Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredRestaurants.map((restaurant) => (
            <div
              key={restaurant.id}
              className="group bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md hover:border-[#25D366] transition-all duration-300"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-xl font-bold text-gray-800">{restaurant.name}</h3>
                {restaurant.bookingAvailable && (
                  <span className="px-2 py-1 text-xs bg-[#DCF8C6] text-[#128C7E] rounded">
                    Available
                  </span>
                )}
              </div>

              <p className="text-sm text-gray-600 mb-4">
                {restaurant.area}, {restaurant.city}
              </p>

              {/* Cuisines */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {restaurant.cuisines.map((cuisine) => (
                  <span
                    key={cuisine}
                    className="px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                  >
                    {cuisine}
                  </span>
                ))}
              </div>

              {/* Vibe */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {restaurant.vibe.map((v) => (
                  <span key={v} className="px-2.5 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                    {v}
                  </span>
                ))}
              </div>

              {/* Price and Rating */}
              <div className="flex items-center justify-between mb-4">
                <span
                  className={`px-3 py-1 text-xs rounded font-semibold ${
                    restaurant.price === "low"
                      ? "bg-green-100 text-green-700"
                      : restaurant.price === "mid"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-red-100 text-red-700"
                  }`}
                >
                  {restaurant.price.toUpperCase()}
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-yellow-500">★</span>
                  <span className="text-sm font-semibold text-gray-700">{restaurant.rating}</span>
                </div>
              </div>

              {/* Highlights */}
              {restaurant.highlights.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs text-gray-500 mb-1.5">Highlights:</p>
                  <p className="text-sm text-gray-700">
                    {restaurant.highlights.slice(0, 2).join(", ")}
                  </p>
                </div>
              )}

              {/* View Button */}
              <button
                onClick={() => setSelectedRestaurant(restaurant)}
                className="w-full mt-4 px-4 py-2.5 whatsapp-green text-white rounded-lg hover:opacity-90 transition-all font-medium"
              >
                View Details
              </button>
            </div>
          ))}
        </div>

        {/* Empty State */}
        {filteredRestaurants.length === 0 && (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <span className="text-4xl">🔍</span>
            </div>
            <p className="text-gray-600 text-lg mb-2">No restaurants found</p>
            <p className="text-gray-500 text-sm mb-6">Try adjusting your filters</p>
            <button
              onClick={clearFilters}
              className="px-6 py-3 whatsapp-green text-white rounded-lg hover:opacity-90 transition-all font-medium"
            >
              Clear Filters
            </button>
          </div>
        )}
      </div>

      {/* Modal */}
      {selectedRestaurant && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedRestaurant(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-800">{selectedRestaurant.name}</h2>
              <button
                onClick={() => setSelectedRestaurant(null)}
                className="text-gray-500 hover:text-gray-700 text-3xl leading-none transition-colors"
              >
                ×
              </button>
            </div>

            <pre className="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm text-gray-700 border border-gray-200">
              {JSON.stringify(selectedRestaurant, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}

