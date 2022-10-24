const session = require("express-session");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const GitHubStrategy = require("passport-github").Strategy;
const bcrypt = require("bcrypt");
const ObjectID = require("mongodb").ObjectID;
const MongoStore = require("connect-mongo")(session);
require("dotenv").config();

module.exports = function (app, myDataBase) {
  const store = new MongoStore({ url: process.env.MONGO_URI });
  app.use(
    session({
      key: "express.sid",
      secret: process.env.SESSION_SECRET,
      resave: true,
      saveUninitialized: true,
      store: store,
      cookie: { secure: false },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  passport.serializeUser((user, done) => {
    done(null, user._id);
  });

  passport.deserializeUser((id, done) => {
    myDataBase.findOne({ _id: new ObjectID(id) }, (err, doc) => {
      done(null, doc);
    });
  });

  passport.use(
    new LocalStrategy(function (username, password, done) {
      myDataBase.findOne({ username: username }, function (err, user) {
        console.log("User " + username + " attempted to log in.");
        if (err) {
          return done(err);
        }
        if (!user) {
          return done(null, false);
        }
        if (!bcrypt.compareSync(password, user.password)) {
          return done(null, false);
        }
        return done(null, user);
      });
    })
  );
  passport.use(
    new GitHubStrategy(
      {
        clientID: process.env.GITHUB_CLIENT_ID,
        clientSecret: process.env.GITHUB_CLIENT_SECRET,
        callbackURL: "https://uckqc0-3000.preview.csb.app/auth/github/callback",
      },
      function (accessToken, refreshToken, profile, cb) {
        console.log(profile);
        //Database logic here with callback containing our user object
        myDataBase.findOneAndUpdate(
          { id: profile.id },
          {
            $setOnInsert: {
              id: profile.id,
              name: profile.displayName || "John Doe",
              photo: profile.photos[0].value || "",
              email: Array.isArray(profile.emails)
                ? profile.emails[0].value
                : "No public email",
              created_on: new Date(),
              provider: profile.provider || "",
            },
            $set: {
              last_login: new Date(),
            },
            $inc: {
              login_count: 1,
            },
          },
          { upsert: true, new: true },
          (err, doc) => {
            return cb(null, doc.value);
          }
        );
      }
    )
  );
};
