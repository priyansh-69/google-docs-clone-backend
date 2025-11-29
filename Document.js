const { Schema, model } = require("mongoose")

const Document = new Schema({
  _id: String,
  data: Object,
  title: {
    type: String,
    default: "Untitled Document",
  },
  createdBy: {
    type: Schema.Types.ObjectId,
    ref: "User",
    immutable: true  // Can never be changed
  },
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User",
  },
  collaborators: [
    {
      user: {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
      permission: {
        type: String,
        enum: ['owner', 'editor', 'viewer'],  // Added 'owner'
        default: 'viewer'
      }
    },
  ],
  shareLink: {
    token: {
      type: String,
      unique: true,
      sparse: true
    },
    permission: {
      type: String,
      enum: ['viewer', 'editor'],
      default: 'viewer'
    },
    enabled: {
      type: Boolean,
      default: false
    },
    createdAt: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

// Update the updatedAt timestamp before saving
Document.pre('save', function (next) {
  this.updatedAt = Date.now()
  next()
})

module.exports = model("Document", Document)
