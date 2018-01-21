var mongoose = require("mongoose");

var pollSchema = mongoose.Schema({
  number: { type: Number, required: true, unique: true},
  createdBy: { type: String, required: true},
  title: { type: String, required: true},
  options: { type : Array , "default" : [] },  
  values: { type : Array , "default" : [] }  
});

var Poll = mongoose.model("Poll", pollSchema);
module.exports = Poll;