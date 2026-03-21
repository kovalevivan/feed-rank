const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

const analytics = require('../services/telegramAnalytics');

const run = async () => {
  if (!process.env.MONGODB_URI) {
    throw new Error('MONGODB_URI is not configured');
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    directConnection: true,
    replicaSet: undefined
  });

  await analytics.init();
  const result = await analytics.backfillFromMongo();
  console.log(JSON.stringify(result, null, 2));

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
