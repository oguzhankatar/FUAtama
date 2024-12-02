const mongoose = require('mongoose');

const TempDataSchema = new mongoose.Schema({
    data: [{
        type: Object
    }],
    uploadDate: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('TempData', TempDataSchema);
