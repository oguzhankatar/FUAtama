const mongoose = require('mongoose');

const lctrDataSchema = new mongoose.Schema({
    // Schema will be similar to ExcelData but specific to LCTR
    data: {
        type: Array,
        required: true
    },
    uploadDate: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('LctrData', lctrDataSchema);
