import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  useMyShop,
  useUpdateMyShop,
  useCreateShop,
  useCloseMyShop,
  useReopenMyShop,
} from "@/hooks/useShops";
import { useCreateService, useDeleteService } from "@/hooks/useServices";
import { useCategories } from "@/hooks/useCategories";
import { ShopPhotosTab } from "./ShopPhotosTab";
import { ShopBookingsTab } from "./ShopBookingsTab";
import { ShopOrdersTab } from "./ShopOrdersTab";
import { ShopProductsTab } from "./ShopProductsTab";
import type { Shop } from "@/types";

function CreateShopForm() {
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const createShop = useCreateShop();

  const [shopName, setShopName] = useState("");
  const [description, setDescription] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [categoryId, setCategoryId] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shopName || !categoryId) return;
    createShop.mutate({
      shopName,
      description: description || undefined,
      phone: phone || undefined,
      address: address || undefined,
      city: city || undefined,
      categoryId,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shop Details</CardTitle>
        <CardDescription>
          Your shop will need approval from an admin before it appears publicly
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {createShop.isError && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
              Couldn't create your shop. Please try again.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shop Name
            </label>
            <Input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Your shop name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              disabled={categoriesLoading}
              className="border-input flex h-9 w-full rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs outline-none"
            >
              <option value="">Select a category</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your shop and expertise"
              rows={4}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <Input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Your city"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <Input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Your shop address"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={createShop.isPending || !shopName || !categoryId}
          >
            {createShop.isPending ? "Creating..." : "Create Shop"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function ShopProfileForm({ shop }: { shop: Shop }) {
  const updateShop = useUpdateMyShop();
  const closeShop = useCloseMyShop();
  const reopenShop = useReopenMyShop();
  const [shopName, setShopName] = useState(shop.shopName);
  const [description, setDescription] = useState(shop.description ?? "");
  const [phone, setPhone] = useState(shop.phone ?? "");
  const [address, setAddress] = useState(shop.address ?? "");
  const [city, setCity] = useState(shop.city ?? "");

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateShop.mutate({ shopName, description, phone, address, city });
  };

  return (
    <div className="space-y-6">
      {shop.status === "closed" && (
        <div className="p-4 bg-gray-100 border border-gray-300 rounded-lg flex items-center justify-between flex-wrap gap-2">
          <p className="text-sm text-gray-700">
            Your shop is closed and hidden from public listings.
          </p>
          <Button
            size="sm"
            disabled={reopenShop.isPending}
            onClick={() => reopenShop.mutate()}
          >
            {reopenShop.isPending ? "Reopening..." : "Reopen Shop"}
          </Button>
        </div>
      )}
      {shop.status === "suspended" && (
        <div className="p-4 bg-red-100 border border-red-300 rounded-lg text-sm text-red-800">
          Your shop was suspended by an admin and is hidden from public
          listings. Contact support if you believe this is a mistake.
        </div>
      )}
      {shop.status === "pending" && (
        <div className="p-4 bg-yellow-100 border border-yellow-300 rounded-lg text-sm text-yellow-800">
          Your shop is pending admin approval and isn't publicly visible yet.
        </div>
      )}

      <Card>
      <CardHeader>
        <CardTitle>Shop Information</CardTitle>
        <CardDescription>
          Update your shop details and contact information
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSaveProfile} className="space-y-6">
          {updateShop.isError && (
            <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
              Couldn't save your changes. Please try again.
            </div>
          )}
          {updateShop.isSuccess && (
            <div className="p-3 bg-green-100 border border-green-300 rounded-lg text-green-800 text-sm">
              Shop updated.
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Shop Name
            </label>
            <Input
              type="text"
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              placeholder="Your shop name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Category
            </label>
            <Input
              type="text"
              value={shop.category?.name ?? ""}
              disabled
              className="bg-gray-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your shop and expertise"
              rows={4}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone
              </label>
              <Input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 (555) 000-0000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City
              </label>
              <Input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Your city"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Address
            </label>
            <Input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Your shop address"
            />
          </div>

          <Button type="submit" className="w-full" disabled={updateShop.isPending}>
            {updateShop.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </form>
      </CardContent>
      </Card>

      {shop.status === "active" && (
        <Card>
          <CardContent className="pt-6 flex items-center justify-between flex-wrap gap-2">
            <div>
              <p className="font-medium text-gray-900">Close Shop</p>
              <p className="text-sm text-gray-600">
                Temporarily hide your shop from public listings. You can reopen it any time.
              </p>
            </div>
            <Button
              variant="destructive"
              disabled={closeShop.isPending}
              onClick={() => closeShop.mutate()}
            >
              {closeShop.isPending ? "Closing..." : "Close Shop"}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function ArtisanProfilePage() {
  const { data: shop, isLoading, isError } = useMyShop();
  const createService = useCreateService();
  const deleteService = useDeleteService();

  const [activeTab, setActiveTab] = useState<
    "profile" | "services" | "products" | "photos" | "bookings" | "orders"
  >("profile");

  const [newService, setNewService] = useState({
    name: "",
    description: "",
    price: "",
    duration: "",
  });

  const handleAddService = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newService.name || !newService.price) return;
    createService.mutate(
      {
        name: newService.name,
        description: newService.description || undefined,
        price: Number(newService.price),
        duration: newService.duration || undefined,
      },
      {
        onSuccess: () =>
          setNewService({ name: "", description: "", price: "", duration: "" }),
      },
    );
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="h-64 rounded-xl bg-white animate-pulse" />
        </div>
      </main>
    );
  }

  if (isError || !shop) {
    return (
      <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Create Your Shop</h1>
            <p className="text-gray-600">
              Set up your shop to start listing services and products.
            </p>
          </div>
          <CreateShopForm />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">My Shop</h1>
          <p className="text-gray-600">Manage your shop profile and services</p>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-4 mb-8 border-b border-gray-200">
          <button
            onClick={() => setActiveTab("profile")}
            className={`px-4 py-2 font-medium ${
              activeTab === "profile"
                ? "text-orange-600 border-b-2 border-orange-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Profile
          </button>
          <button
            onClick={() => setActiveTab("services")}
            className={`px-4 py-2 font-medium ${
              activeTab === "services"
                ? "text-orange-600 border-b-2 border-orange-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Services
          </button>
          <button
            onClick={() => setActiveTab("products")}
            className={`px-4 py-2 font-medium ${
              activeTab === "products"
                ? "text-orange-600 border-b-2 border-orange-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Products
          </button>
          <button
            onClick={() => setActiveTab("photos")}
            className={`px-4 py-2 font-medium ${
              activeTab === "photos"
                ? "text-orange-600 border-b-2 border-orange-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Photos
          </button>
          <button
            onClick={() => setActiveTab("bookings")}
            className={`px-4 py-2 font-medium ${
              activeTab === "bookings"
                ? "text-orange-600 border-b-2 border-orange-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Bookings
          </button>
          <button
            onClick={() => setActiveTab("orders")}
            className={`px-4 py-2 font-medium ${
              activeTab === "orders"
                ? "text-orange-600 border-b-2 border-orange-600"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            Orders
          </button>
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && <ShopProfileForm key={shop.id} shop={shop} />}

        {/* Products Tab */}
        {activeTab === "products" && <ShopProductsTab />}

        {/* Photos Tab */}
        {activeTab === "photos" && <ShopPhotosTab />}

        {/* Bookings Tab */}
        {activeTab === "bookings" && <ShopBookingsTab />}

        {/* Orders Tab */}
        {activeTab === "orders" && <ShopOrdersTab />}

        {/* Services Tab */}
        {activeTab === "services" && (
          <div className="space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Add New Service</CardTitle>
                <CardDescription>Create a new service for your shop</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAddService} className="space-y-4">
                  {createService.isError && (
                    <div className="p-3 bg-red-100 border border-red-300 rounded-lg text-red-800 text-sm">
                      Couldn't add the service. Please try again.
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Name
                    </label>
                    <Input
                      type="text"
                      value={newService.name}
                      onChange={(e) =>
                        setNewService({ ...newService, name: e.target.value })
                      }
                      placeholder="e.g., Custom Furniture"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Description
                    </label>
                    <Textarea
                      value={newService.description}
                      onChange={(e) =>
                        setNewService({
                          ...newService,
                          description: e.target.value,
                        })
                      }
                      placeholder="Describe this service"
                      rows={3}
                    />
                  </div>

                  <div className="grid md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price ($)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newService.price}
                        onChange={(e) =>
                          setNewService({ ...newService, price: e.target.value })
                        }
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Duration
                      </label>
                      <Input
                        type="text"
                        value={newService.duration}
                        onChange={(e) =>
                          setNewService({
                            ...newService,
                            duration: e.target.value,
                          })
                        }
                        placeholder="e.g., 2-4 weeks"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={createService.isPending}
                  >
                    {createService.isPending ? "Adding..." : "Add Service"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">
                Your Services
              </h3>
              {(shop.services ?? []).length === 0 ? (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-center text-gray-600">
                      No services added yet
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {(shop.services ?? []).map((service) => (
                    <Card key={service.id}>
                      <CardHeader>
                        <CardTitle className="text-lg">{service.name}</CardTitle>
                        {service.description && (
                          <CardDescription>{service.description}</CardDescription>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-gray-500">Price</p>
                            <p className="text-2xl font-bold text-gray-900">
                              ${Number(service.price).toFixed(2)}
                            </p>
                          </div>
                          {service.duration && (
                            <div>
                              <p className="text-sm text-gray-500">Duration</p>
                              <p className="font-semibold text-gray-900">
                                {service.duration}
                              </p>
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 pt-2">
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1"
                            disabled={
                              deleteService.isPending &&
                              deleteService.variables === service.id
                            }
                            onClick={() => deleteService.mutate(service.id)}
                          >
                            {deleteService.isPending &&
                            deleteService.variables === service.id
                              ? "Deleting..."
                              : "Delete"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
