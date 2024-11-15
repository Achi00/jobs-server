const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL:
        process.env.GOOGLE_CALLBACK_URL ||
        "https://linkedinapi.wordcrafter.io/auth/google/callback",
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        const email =
          profile.emails && profile.emails.length > 0
            ? profile.emails[0].value
            : null;
        const photo =
          profile.photos && profile.photos.length > 0
            ? profile.photos[0].value
            : null;

        if (!email) {
          throw new Error("No email associated with this account!");
        }

        // Check if a user with the given email already exists
        let user = await User.findOne({ email });
        if (user) {
          // Update the user with the latest Google profile info
          user.googleId = profile.id;
          user.displayName = profile.displayName;
          user.photoUrl = photo;
          user.accessToken = accessToken;
          user.refreshToken = refreshToken;
          await user.save();
        } else {
          // Create a new user
          user = new User({
            googleId: profile.id,
            displayName: profile.displayName,
            email: email,
            photoUrl: photo,
            accessToken: accessToken,
            refreshToken: refreshToken,
            industry: "",
            skills: [],
            experience: [],
          });
          await user.save();
        }

        return done(null, user);
      } catch (err) {
        done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

module.exports = passport;
