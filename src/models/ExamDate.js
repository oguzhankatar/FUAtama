const mongoose = require('mongoose');

const examDateSchema = new mongoose.Schema({
    dkodu: {
        type: String,
        required: true
    },
    dadi: {
        type: String,
        required: true
    },
    examDate: {
        type: Date,
        required: false
    },
    dataType: {
        type: String,
        enum: ['lctrdata', 'sorunlu'],
        required: true
    },
    note: {
        type: String,
        default: ''
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ExamDate', examDateSchema);
