const mongoose = require('mongoose');

const QuizResultSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Student is required']
  },
  quiz: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quiz',
    required: [true, 'Quiz is required']
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course',
    required: [true, 'Course is required']
  },
  answers: [{
    questionIndex: {
      type: Number,
      required: true
    },
    selectedOption: {
      type: Number,
      required: true
    },
    isCorrect: {
      type: Boolean,
      default: false
    }
  }],
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  score: {
    type: Number,
    default: 0
  },
  totalQuestions: {
    type: Number,
    required: true
  },
  passed: {
    type: Boolean,
    default: false
  },
  attempt: {
    type: Number,
    default: 1
  }
}, {
  timestamps: true
});

// Calculate score before saving
QuizResultSchema.pre('save', function(next) {
  if (this.answers && this.answers.length > 0) {
    const correctAnswers = this.answers.filter(answer => answer.isCorrect).length;
    this.score = correctAnswers;
    
    // Determine if passed (assuming 60% is passing)
    const passingScore = Math.ceil(this.totalQuestions * 0.6);
    this.passed = this.score >= passingScore;
  }
  
  next();
});

module.exports = mongoose.model('QuizResult', QuizResultSchema);
