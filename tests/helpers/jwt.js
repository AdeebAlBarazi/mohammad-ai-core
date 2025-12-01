const jwt = require("jsonwebtoken");

exports.createSellerToken = () => {
  return jwt.sign(
    { userId: "test-seller-id", role: "seller" },
    process.env.JWT_PRIVATE_KEY,
    { algorithm: "RS256", expiresIn: "1h" }
  );
};
