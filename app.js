//jshint esversion:6
require("dotenv").config();
const express = require("express");
const ejs = require("ejs");
const mongoose = require("mongoose");
// const encrypt = require("mongoose-encryption");
// const md5 = require("md5");
// const bcrypt = require("bcrypt");
// const saltRounds = 10;
const session = require("express-session");
const passport = require("passport");
const passportLocalMongoose = require("passport-local-mongoose");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const findOrCreate = require("mongoose-findorcreate");

const app = express();
const port = process.env.PORT || 3000;

// console.log(process.env.SECRET);

app.set("view engine", "ejs");

app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
//Initialise Express-Session
app.use(
  session({
    secret: "Our little secret.",
    resave: false,
    saveUninitialized: true,
    cookie: {},
  })
);
//Initialise Passport
app.use(passport.initialize());
app.use(passport.session());

main().catch((err) => console.log(err));
async function main() {
  await mongoose.connect("mongodb://127.0.0.1:27017/userDB");
}
//Created Schema
const usersSchema = new mongoose.Schema({
  email: String,
  password: String,
  googleId: String,
  facebookId: String,
  secret: String,
});

// usersSchema.plugin(encrypt, {
//   secret: process.env.SECRET,
//   encryptedFields: ["password"],
//   excludeFromEncryption: ["email"],
// });

//to hash and sort our passwords and to save our users into our MongoDB database
usersSchema.plugin(passportLocalMongoose);
usersSchema.plugin(findOrCreate);

//Created model
const User = mongoose.model("User", usersSchema);

// //configure passport local strategy
// passport.use(new LocalStrategy(
//     function(username, password, done) {
//       User.findOne({ username: username })
//       .then((founduser)=>{
//         if(!founduser){return done(null, false);}

//         bcrypt.compare(password,founduser.password, (err, result) => {
//             if (err){return done(err);}
//             if (result) {return done(null,founduser);}
//             return done (null,false);
//         });
//       })
//       .catch((err)=>{
//         return done(err);
//       })
//     }
// ));

//Using passport to create local login
passport.use(User.createStrategy());
passport.serializeUser(function (user, done) {
  done(null, user);
});
passport.deserializeUser(async function (id, done) {
  let err, user;
  try {
    user = await User.findById(id).exec();
  } catch (e) {
    err = e;
  }
  return done(err, user);
});
//Google strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.CLIENT_ID,
      clientSecret: process.env.CLIENT_SECRET,
      callbackURL: "http://localhost:3000/auth/google/secrets",
    },
    function (accessToken, refreshToken, profile, cb) {
      console.log(profile);
      User.findOrCreate({ googleId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);
// -------FACEBOOK STRATEGY--------
passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.APP_ID,
      clientSecret: process.env.APP_SECRET,
      callbackURL: "http://localhost:3000/auth/facebook/secrets",
      enableProof: true,
    },
    function (accessToken, refreshToken, profile, cb) {
      User.findOrCreate({ facebookId: profile.id }, function (err, user) {
        return cb(err, user);
      });
    }
  )
);

app.get("/", (req, res) => {
  res.render("home");
});
//Google authentication
app.get(
  "/auth/google",
  passport.authenticate("google", { scope: ["profile"] })
);
app.get(
  "/auth/google/secrets",
  passport.authenticate("google", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/secrets");
  }
);
// -----FACEBOOK AUTHENTICATION-----
app.get(
  "/auth/facebook",
  passport.authenticate("facebook", { scope: ["email"] })
);
app.get(
  "/auth/facebook/secrets",
  passport.authenticate("facebook", { failureRedirect: "/login" }),
  function (req, res) {
    // Successful authentication, redirect secrets.
    res.redirect("/secrets");
  }
);

app.get("/login", (req, res) => {
  res.render("login");
});
app.get("/register", (req, res) => {
  res.render("register");
});
// app.get("/secrets", (req, res) => {
//   User.find({"secret":{$ne:null}}).then((foundUser)=>{
//     if(foundUser){
//       res.render("secrets",{UsersWithSecrets:foundUser})
//     }
//   }).catch((err)=>{
//     console.log(err);
//   })
// });
app.get("/secrets", function(req, res){
  User.find({ secret: { $ne: null } })
  .then(foundUsers=>{
    if (foundUsers) {
      res.render("secrets", { usersWithSecrets: foundUsers });
    }
  })
  .catch(err =>{console.log(err)});
});
app.get("/submit", (req, res) => {
  if (req.isAuthenticated()) {
    res.render("submit");
  } else {
    res.redirect("/login");
  }
});
app.post("/submit", (req, res) => {
  const submittedSecrtet = req.body.secret;
  console.log(req.user._id);
  // User.findById(req.user._id, (err, foundUser) => {
  //   if (err) {
  //     console.log(err);
  //   } else {
  //     if (foundUser) {
  //       foundUser.secret = submittedSecrtet;
  //       foundUser.save(function () {
  //         res.redirect("/secrets");
  //       });
  //     }
  //   }
  // });
  User.findById(req.user._id)
    .then((foundUser) => {
      if (foundUser) {
        foundUser.secret = submittedSecrtet;
        foundUser.save();
        res.redirect("/secrets");
      }
    })
    .catch((err) => {
      console.log(err);
    });
});
app.get("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      console.log(err);
    } else {
      res.redirect("/");
    }
  });
});
// app.post("/register", (req, res) => {
//   bcrypt.hash(req.body.password, saltRounds, function (err, hash) {
//     const newUser = new User({
//       email: req.body.username,
//       password: hash,
//     });
//     newUser
//       .save()
//       .then(res.render("secrets"))
//       .catch((err) => console.log(err));
//   });
// });
app.post("/register", (req, res) => {
  User.register(
    { username: req.body.username },
    req.body.password,
    function (err, user) {
      if (err) {
        console.log(err);
        res.redirect("/register");
      } else {
        passport.authenticate("local")(req, res, function (err, user) {
          res.redirect("/secrets");
        });
      }
    }
  );
});

// app.post("/login", function (req, res) {
//   const username = req.body.username;
//   const password = req.body.password;
//   User.findOne({ email: username }) //your email is encrypted so it's not comparable here
//     .then((foundUser) => {
//       if (foundUser) {
//         bcrypt.compare(password, foundUser.password, function(err, result) {
//             if(result === true){
//                 res.render("secrets");
//             }
//             else{
//                 res.render("login");
//             }
//         });
//       } else {
//         // res.write("no user found.please first signup");
//         res.render("register");
//       }
//     })
//     .catch((err) => console.error(err));
// });
app.post("/login", function (req, res) {
  const user = new User({
    username: req.body.username,
    password: req.body.password,
  });
  req.login(user, function (err, user) {
    if (err) {
      console.log(err);
    } else {
      passport.authenticate("local")(req, res, function (err, user) {
        res.redirect("/secrets");
      });
    }
  });
});

app.listen(port, function (req, res) {
  console.log(`Server is listening on port ${port}.`);
});
