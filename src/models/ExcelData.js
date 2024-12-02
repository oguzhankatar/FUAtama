const mongoose = require('mongoose');

const excelDataSchema = new mongoose.Schema({
    fileName: {
        type: String,
        required: true
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },
    data: {
        type: Array,
        required: true
    }
}, {
    strict: false
});

module.exports = mongoose.model('ExcelData', excelDataSchema);
