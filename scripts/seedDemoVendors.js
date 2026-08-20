// One-off demo data seed: creates the same showcase vendors/reviews used in
// the frontend's placeholder dataset (yursay/src/data/vendors.js), but as
// real rows served by the API. Uses model .create() + recalculateVendorStats
// so denormalized stats (avgRating, trustScore, trustSignals) are computed
// by the same logic production traffic uses, not hand-copied numbers.
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./../models');
const { User, PersonalProfile, Category, City, Vendor, Review } = db;
const { recalculateVendorStats } = require('../utils/trustScore');

const REVIEWERS = [
  { email: 'seed.adaeze@yursay.demo', fullName: 'Adaeze Nwosu' },
  { email: 'seed.kola@yursay.demo', fullName: 'Kola Ogundele' },
  { email: 'seed.fatima@yursay.demo', fullName: 'Fatima Aliyu' },
  { email: 'seed.emeka@yursay.demo', fullName: 'Emeka Balogun' },
  { email: 'seed.chidinma@yursay.demo', fullName: 'Chidinma Okoro' },
];

const VENDORS = [
  { key: 'bella-glow', name: 'Bella Glow Beauty', category: 'beauty-wellness', city: 'Lekki', handle: '@bellaglowng', verified: true,
    description: 'Premium skincare and cosmetics vendor operating from Lekki, Lagos. Specializing in authentic international beauty brands.' },
  { key: 'trendy-kicks', name: 'Trendy Kicks NG', category: 'fashion-style', city: 'Yaba', handle: '@trendykicksng', verified: true,
    description: 'Authentic sneakers and streetwear, delivered same-day within Lagos. Every pair verified genuine before dispatch.' },
  { key: 'mama-j', name: "Mama J's Amala Spot", category: 'food-restaurants', city: 'Surulere', handle: null, verified: true,
    description: 'Home-style Nigerian food, famous for amala and ewedu, serving Surulere and beyond.' },
  { key: 'techfix', name: 'TechFix Pro Lagos', category: 'tech-services', city: 'Ikeja', handle: '@techfixpro', verified: true,
    description: 'Phone and laptop repair, screen replacement, and diagnostics with same-day turnaround.' },
  { key: 'glow-skin', name: 'GlowSkin Essentials', category: 'beauty-wellness', city: 'Victoria Island', handle: '@glowskinng', verified: false,
    description: 'Curated skincare essentials sourced directly from international brands.' },
  { key: 'chic-shop', name: 'ChicShop Lagos', category: 'fashion-style', city: 'Ajah', handle: '@chicshoplag', verified: false,
    description: 'Trendy womenswear and accessories, restocked weekly.' },
  { key: 'freshbites', name: 'FreshBites Delivery', category: 'food-restaurants', city: 'Lekki', handle: null, verified: true,
    description: 'Fresh meals delivered across Lekki and Ajah within the hour.' },
  { key: 'glam-yemi', name: 'Glam by Yemi', category: 'beauty-wellness', city: 'Ikoyi', handle: '@glambyyyemi', verified: true,
    description: 'Bridal and event makeup artistry, bookings across Lagos.' },
];

const REVIEWS = [
  { vendor: 'bella-glow', reviewer: 'seed.adaeze@yursay.demo', rating: 5, tags: ['Delivery', 'As Advertised', 'Quality'],
    content: 'The skincare products arrived exactly as advertised. Packaging was pristine and delivery was next day. Bella Glow is my new go-to for authentic beauty in Lagos!',
    reply: "Thank you so much, Adaeze! We're thrilled you're happy. Looking forward to serving you again soon!" },
  { vendor: 'trendy-kicks', reviewer: 'seed.kola@yursay.demo', rating: 4, tags: ['Delivery', 'Authenticity'],
    content: 'Ordered Nike Air Max and received genuine product. Delivery took 2 days as promised. Minor packaging issue but the vendor resolved it quickly. Solid experience.' },
  { vendor: 'mama-j', reviewer: 'seed.fatima@yursay.demo', rating: 5, tags: ['Quality', 'Value for Money', 'Speed'],
    content: 'Best amala in Lagos, full stop. Tried it on a YurSay recommendation and it did not disappoint. The ewedu was exceptional and portions were generous. Will be back weekly!' },
  { vendor: 'trendy-kicks', reviewer: 'seed.emeka@yursay.demo', rating: 5, tags: ['As Advertised', 'Speed', 'Communication'],
    content: 'Trendy Kicks delivered genuine Jordans same day within Lagos. No drama, communicated throughout. This is what online shopping in Nigeria should feel like.' },
  { vendor: 'trendy-kicks', reviewer: 'seed.chidinma@yursay.demo', rating: 3, tags: ['Delivery', 'Communication'],
    content: 'Product was decent but delivery took longer than expected. Vendor was responsive when I raised it. Not bad overall — just manage delivery time expectations.',
    reply: "Hi Chidinma, we sincerely apologize for the delay. We've since upgraded our logistics partner. Thank you for the honest feedback!" },
];

async function ensureReviewer({ email, fullName }) {
  let user = await User.findOne({ where: { email } });
  if (user) return user;

  const password = await bcrypt.hash(`Seed-${Math.random().toString(36).slice(2)}!Aa1`, 10);
  user = await User.create({
    email,
    password,
    userType: 'personal',
    verified: true,
    status: 'active',
    onboardingCompleted: true,
  });
  await PersonalProfile.create({ userId: user.id, firstName: fullName.split(' ')[0], lastName: fullName.split(' ').slice(1).join(' '), displayName: fullName, onboardingCompleted: true });
  return user;
}

async function run() {
  const categories = await Category.findAll();
  const categoryBySlug = Object.fromEntries(categories.map((c) => [c.slug, c.id]));

  const cities = await City.findAll();
  const cityByName = Object.fromEntries(cities.map((c) => [c.name, c.id]));

  const reviewerByEmail = {};
  for (const r of REVIEWERS) {
    reviewerByEmail[r.email] = await ensureReviewer(r);
  }

  const vendorByKey = {};
  for (const v of VENDORS) {
    let vendor = await Vendor.findOne({ where: { name: v.name } });
    if (!vendor) {
      vendor = await Vendor.create({
        name: v.name,
        primaryPlatform: v.handle ? 'instagram' : null,
        handle: v.handle,
        categoryId: categoryBySlug[v.category] || null,
        cityId: cityByName[v.city] || null,
        address: `${v.city}, Lagos`,
        description: v.description,
      });
      if (v.verified) {
        await vendor.update({ verificationStatus: 'verified' });
      }
    }
    vendorByKey[v.key] = vendor;
  }

  for (const r of REVIEWS) {
    const vendor = vendorByKey[r.vendor];
    const reviewer = reviewerByEmail[r.reviewer];
    const existing = await Review.findOne({ where: { vendorId: vendor.id, reviewerId: reviewer.id } });
    if (existing) continue;

    await Review.create({
      vendorId: vendor.id,
      reviewerId: reviewer.id,
      rating: r.rating,
      tags: r.tags,
      content: r.content,
      vendorResponse: r.reply || null,
      vendorRespondedAt: r.reply ? new Date() : null,
    });
  }

  for (const vendor of Object.values(vendorByKey)) {
    await recalculateVendorStats(vendor.id);
  }

  console.log(`Seeded ${Object.keys(vendorByKey).length} vendors and ${REVIEWS.length} reviews.`);
  process.exit(0);
}

run().catch((error) => {
  console.error('Seed demo vendors failed:', error);
  process.exit(1);
});
