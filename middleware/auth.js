const jwt = require("jsonwebtoken");
require("dotenv").config();
const getCookieValue = require("../helper/cookieHandler");
const User = require("../model/User");

const refreshToekn = (res, email, userId, ip, userAgent) => {
  const secret = process.env.SECRET;

  const expireTime = process.env.EXTEND_LOGIN_EXPIRES;
  const expireTimeToken = Date.now() + Number(expireTime);
  

  const token = jwt.sign(
    {
      email: email,
      userId: userId,
      ip: ip,
      userAgent: userAgent,
      expireTime: expireTimeToken,
    },
    secret,
    { expiresIn: Number(expireTime) / 1000 }
  );

  const domain = process.env.DOMAIN || "localhost";

  const options = {
    maxAge: expireTime,
    httpOnly: true,
    domain: domain,
  };

  if (process.env.APPLICATION_START_MODE === "production") {
    options.secure = true;
    options.sameSite = "None";
  }
  return token;

};

module.exports = (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader) {
    const error = new Error("invalid token");
    error.data = "invalid token";
    error.statusCode = 401;
    throw error;
  }
  
  const token = authHeader.split(' ')[1];

  

  let decodeToken;
  const secret = process.env.SECRET;

  try {
    decodeToken = jwt.verify(token, secret);
  } catch (err) {
    err.statusCode = 401;
    err.data = "invalid token";
    throw err;
  }

  req.userId = decodeToken.userId;

  User.findById(req.userId)
    .then((user) => {
      if (!user) {
        const error = new Error("invalid user");
        throw error;
      }

      const isTokenPresent = user.blockedToken.some(
        (blockedToken) => blockedToken.type === token
      );

      if (isTokenPresent) {
        const error = new Error("invalid token");
        throw error;
      }

      const conditionTime = decodeToken.expireTime - 3600000;
      const date = Date.now();

      if (date >= conditionTime) {
        refreshToekn(
          res,
          decodeToken.email,
          decodeToken.userId,
          decodeToken.ip,
          decodeToken.userAgent
        );
      }
      next();
    })
    .catch((err) => {
      err.statusCode = 401;
      err.data = "invalid token";
      next(err);
    });
};
