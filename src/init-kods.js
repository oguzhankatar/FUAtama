const mongoose = require('mongoose');

// MongoDB Atlas bağlantı URL'i
const mongoURI = 'mongodb+srv://ogi:oka2323@cluster0.8ftdb.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0';

async function initializeKods() {
    try {
        // MongoDB'ye bağlan
        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log('MongoDB\'ye başarıyla bağlandı');

        // kods collection'ına direkt erişim
        const kodsCollection = mongoose.connection.collection('kods');

        // Koleksiyonu temizle
        await kodsCollection.deleteMany({});
        console.log('Mevcut veriler temizlendi');

        // Yeni verileri doğru formatta ekle
        const kodData = [
            { field: "505", value: "Yazılım Müh." },
            { field: "211", value: "Deneme Müh." }
        ];

        const result = await kodsCollection.insertMany(kodData);
        console.log('Veriler başarıyla eklendi:', result);

        // Eklenen verileri kontrol et
        const kods = await kodsCollection.find({}).toArray();
        console.log('Mevcut kodlar:', kods);

    } catch (error) {
        console.error('Hata:', error);
    } finally {
        // Bağlantıyı kapat
        await mongoose.connection.close();
        console.log('MongoDB bağlantısı kapatıldı');
    }
}

// Script'i çalıştır
initializeKods();
