import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function HomePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    navigate(q ? `/categories?search=${encodeURIComponent(q)}` : "/categories");
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-orange-100">
      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center space-y-8">
            <div className="space-y-4">
              <h1 className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-orange-700 via-amber-600 to-orange-600 bg-clip-text text-transparent">
                Connect with Skilled Artisans
              </h1>
              <p className="text-xl text-amber-900 max-w-2xl mx-auto leading-relaxed">
                Discover exceptional craftsmanship. Find the perfect artisan
                for your project, browse curated services, and connect
                directly.
              </p>
            </div>

            {/* Search Bar */}
            <form
              onSubmit={handleSearch}
              className="max-w-2xl mx-auto mt-10"
            >
              <div className="flex gap-2 bg-white/80 backdrop-blur-sm p-2 rounded-lg border-2 border-orange-200 shadow-lg hover:shadow-xl transition-shadow">
                <Input
                  type="text"
                  placeholder="Search artisans or services..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 border-0 focus-visible:ring-0 placeholder-amber-700"
                />
                <Button
                  type="submit"
                  className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700"
                >
                  Search
                </Button>
              </div>
            </form>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register?type=client">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-700 hover:to-amber-700 text-white px-8"
                >
                  Find an Artisan
                </Button>
              </Link>
              <Link to="/register?type=artisan">
                <Button
                  variant="outline"
                  size="lg"
                  className="border-2 border-orange-600 text-orange-700 hover:bg-orange-50 px-8"
                >
                  Start Your Shop
                </Button>
              </Link>
              <Link to="/categories">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-700 hover:to-orange-700 text-white px-8"
                >
                  Browse Categories
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            How It Works
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                🔍
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Find
              </h3>
              <p className="text-gray-600">
                Browse artisans by category or search for specific skills
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                💬
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Connect
              </h3>
              <p className="text-gray-600">
                Contact artisans directly via WhatsApp or phone
              </p>
            </div>
            <div className="text-center">
              <div className="bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl">
                ✓
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Complete
              </h3>
              <p className="text-gray-600">
                Work directly with artisans to get your project done
              </p>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
