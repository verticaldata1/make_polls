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
app.get("/", function (req, res, next) {
  Poll.find({}, function(err, polls) {
    if(err) { return next(err); }
    
    res.locals.recentPolls = [];
    if(polls) {
      var recentPollsTmp = [];
      for(var ii = polls.length - 1; ii >= 0; ii--) {
        var title = polls[ii].title;
        var link = "/poll/"+polls[ii].number;
        recentPollsTmp.push({title: title, link: link});
        if(recentPollsTmp.length >= 5)
          break;
      }
      res.locals.recentPolls = recentPollsTmp;
    }
    
    res.render("index");
  });
  
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


function isAuthenticated(req,res,next) {
  if(req.isAuthenticated()){
    next();
  }
  else {
    req.flash("error", "Please log in first");
    res.redirect("/login");
  }
}

app.get("/new-poll", function(req, res) {
  res.render("new_poll");
});

app.post("/new-poll", isAuthenticated, function(req, res, next) {
  var title = req.body.title;
  var options = req.body.options;
  options = options.replace(/,+$/g, "");
  options = options.split(",");
  var values = [];
  for(var ii = 0; ii < options.length; ii++) {
    values.push(0); 
    options[ii] = options[ii].replace(/^\s+|\s+$/g, "");
  }
  
  var randNum = Math.floor((Math.random() * 2147483647 + 5));
  
  Poll.count({}, function(err , count){
    var newPoll = new Poll({
      number: randNum,
      createdBy: res.locals.currentUser.username,
      title: title,
      options: options,
      values: values
    });
    newPoll.save(function(err) {
      req.user.polls.push(randNum);
      req.user.save(function(err) {
        if(err) {
            next(err);
            return;
        }
        res.redirect("/poll/"+randNum);
      });
    });        
  });
  
});

app.get("/poll/:num", function(req, res, next) {
  var num = req.params.num;
  
  Poll.findOne({number: num}, function(err, poll) {
    if(err) { return next(err); }
    if(!poll) {
      req.flash("error", "Poll not found");
      return res.redirect("/");
    }
    
    res.locals.pollTitle = poll.title;
    res.locals.pollUser = poll.createdBy;
    res.locals.pollOptions = poll.options;
    res.locals.pollValues = poll.values;
    res.locals.pollRedirect = "/poll/"+num;
    res.render("view_poll");
  });
});

app.post("/poll/:num", function(req, res, next) {
  var num = req.params.num;
  var pollUrl = "/poll/"+num;
  
  Poll.findOne({number: num}, function(err, poll) {
    if(err) { return next(err); }
    if(!poll) {
      req.flash("error", "Error casting vote. Poll not found.");
      return res.redirect(pollUrl);
    }
    
    var curVals = poll.values;
    var curOptions = poll.options;
    
    if(req.body.optionCustom) {
      if(poll.options.indexOf(req.body.optionCustom) !== -1) {
        req.flash("error", "Custom option entered, but that option already exists!");
        return res.redirect(pollUrl);
      }
      curOptions.push(req.body.optionCustom);
      curVals.push(1);
    }
    else {    
      var idx = poll.options.indexOf(req.body.optionSelect);
      if(idx === -1) {
        req.flash("error", "Error casting vote. Selection not found.");
        return res.redirect(pollUrl);
      }        
      curVals[idx]++;
    }
    
    Poll.update({number: num}, {values: curVals, options: curOptions}, function(err) {
      if(err) {
        console.log(err);
        next(err);
        return;
      }      
      console.log("saved");
      res.redirect(pollUrl);
    });
    
  });
});

app.get("/profile/:username", function(req, res, next) {
  res.locals.username = req.params.username;
  
  Poll.find({createdBy: req.params.username}, function(err, polls) {
    if(err) { return next(err); }
    
    res.locals.userPolls = [];
    if(polls) {
      for(var ii = polls.length - 1; ii >= 0; ii--) {
        var title = polls[ii].title;
        var link = "/poll/"+polls[ii].number;
        var deleteLink = "/delete/"+polls[ii].number;
        res.locals.userPolls.push({title: title, link: link, deleteLink: deleteLink});
      }
    }    
    res.render("profile");
  });
  
});

app.get("/delete/:num", isAuthenticated, function(req, res, next) {
  var num = req.params.num;
  
  Poll.findOne({number: num}, function(err, poll) {
    if(err) { return next(err); }
    if(!poll) {
      req.flash("error", "Deletion error. Poll not found.");
      return res.redirect("/");
    }
    if(!res.locals.currentUser || poll.createdBy != res.locals.currentUser.username) {
      req.flash("error", "Deletion error. Not owner of the poll.");
      return res.redirect("/");
    }
    
    Poll.find({ number: num }).remove().exec();
    res.redirect("/profile/"+res.locals.currentUser.username);
        
  });
});
      

// listen for requests :)
var listener = app.listen(process.env.PORT, function () {
  console.log('Your app is listening on port ' + listener.address().port);
});
