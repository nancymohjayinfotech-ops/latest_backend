const mongoose = require('mongoose');
const slugify = require('slugify');

const offerSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    trim: true
  },
  code: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  discountType: {
    type: String,
    enum: ['percentage', 'fixed'],
    required: true
  },
  discountValue: {
    type: Number,
    required: true,
    min: 0
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  applicableCourses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  }],
  usageLimit: {
    type: Number,
    default: null // null means unlimited
  },
  usageCount: {
    type: Number,
    default: 0
  },
  minPurchaseAmount: {
    type: Number,
    default: 0
  },
  maxDiscountAmount: {
    type: Number,
    default: null // null means no maximum
  }
}, {
  timestamps: true
});

offerSchema.pre('save', function(next) {
  if (this.isModified('code')) {
    this.code = this.code.toUpperCase();
  }
  next();
});

offerSchema.methods.isValid = function() {
  const now = new Date();
  return (
    this.isActive && 
    now >= this.startDate && 
    now <= this.endDate && 
    (this.usageLimit === null || this.usageCount < this.usageLimit)
  );
};

// Method to apply discount to a price
offerSchema.methods.applyDiscount = function(price) {
  let discountAmount = 0;
  
  if (this.discountType === 'percentage') {
    discountAmount = (price * this.discountValue) / 100;
  } else {
    discountAmount = this.discountValue;
  }
  
  // Apply maximum discount cap if set
  if (this.maxDiscountAmount !== null) {
    discountAmount = Math.min(discountAmount, this.maxDiscountAmount);
  }
  
  // Ensure discount doesn't exceed price
  discountAmount = Math.min(discountAmount, price);
  
  return {
    originalPrice: price,
    discountAmount: discountAmount,
    finalPrice: price - discountAmount
  };
};

module.exports = mongoose.model('Offer', offerSchema);
