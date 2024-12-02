const mongoose = require('mongoose');

const sorunluSchema = new mongoose.Schema({
    data: [{
        dkodu: String,
        sube: String,
        dadi: String,
        program: String,
        kon: Number,
        ogrenciler: [String],
        examDate: String,
        examTime: String,
        examSiniflar: [String]
    }],
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Sorunlu', sorunluSchema);
