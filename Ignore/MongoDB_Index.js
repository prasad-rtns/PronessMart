// Run this script to update the cart collection indexes
// You can run this via MongoDB shell or create a migration file
docker-compose exec mongo-cart mongosh
// Connect to your database
use cartdb;

// Verify the indexes
db.carts.getIndexes();
// 1. Drop the existing unique index on userId
db.carts.dropIndex("userId_1");

// 2. Create a new compound unique index that allows only ONE active cart per user
// but permits multiple carts with other statuses (converted, abandoned, etc.)
db.carts.createIndex(
  { userId: 1, status: 1 },
  { 
    unique: true,
    partialFilterExpression: { status: "active" },
    name: "userId_status_unique_active"
  }
);

// Verify the indexes
db.carts.getIndexes();

// Expected output should show:
// - _id index (default)
// - userId_status_unique_active index with partial filter

console.log("✅ Index migration completed successfully!");
console.log("Users can now have multiple carts with different statuses,");
console.log("but only ONE cart with status='active' at a time.");

// Product Search Optimization (Optional)
db.products.createIndex({ name: "text", description: "text", tags: "text" })