var express = require('express');
var app = express();
var path = require("path");
var mongoose = require("mongoose");
var bodyParser = require("body-parser");
var cookieParser = require("cookie-parser");
var session = require("express-session");
var passport = require("passport");
var flash = require("connect-flash");
var setUpPassport = require("./setuppassport");
var User = require("./models/user");
var Poll = require("./models/poll");

app.set("views", path.resolve(__dirname, "views"));
app.set("view engine", "ejs");

mongoose.connect("mongodb://vd1:"+process.env.VOTING_PASSWORD+"@ds111138.mlab.com:11138/voting");

setUpPassport();

/* middleware: */
app.use(express.static('public'));
app.use(bodyParser.urlencoded({extended: false}));
app.use(cookieParser());
app.use(session ({
  secret : process.env.SECRET,
  resave: true,
  saveUninitialized: true
}));
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());

app.use(function(req, res, next) {
  res.locals.currentUser = req.user;
  res.locals.errors = req.flash("error");
  res.locals.infos = req.flash("info");
  next();
});


/* routes */
app.get("/", function (req, res) {
  res.render("index");
});

app.get("/login", function(req, res) {
  res.render("login");
});

app.post("/login", passport.authenticate("login", {
  successRedirect: "/",
  failureRedirect: "/login",
  failureFlash: true
}));

app.get("/logout", function (req, res) {
  req.logout();
  res.redirect("/");
});

app.get("/signup", function (req, res) {
  res.render("signup");
});

app.post("/signup", function(req, res, next) {
  var username = req.body.username;
  var password = req.body.password;
  
  User.findOne({username: username}, function(err, user) {
    if(err) { return next(err); }
    if(user) {
      req.flash("error", "Username taken");
      return res.redirect("/signup");
    }
    var newUser = new User({
      username: username,
      password: password
    });
    newUser.save(next);
  });
}, passport.authenticate("login", {
  successRedirect: "/",
  failureRedirect: "/signup",
  failureFlash: true
}));


app.get("/new-poll", function(req, res) {
  res.render("new_poll");
});

app.post("/new-poll", function(req, res, next) {
  var title = req.body.title;
  var options = req.body.options;
  options = options.split(",");
  var values = [];
  for(var ii = 0; ii < options.length; ii++) {
    values.push(0); 
  }
  
  Poll.count({}, function(err , count){
    console.log("Current poll count="+count);
    var newPoll = new Poll({
      number: count,
      createdBy: res.locals.currentUser,
      title: title,
      options: options,
      values: values
    });
    newPoll.save(next);
    
    
  });
  
});
      

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
