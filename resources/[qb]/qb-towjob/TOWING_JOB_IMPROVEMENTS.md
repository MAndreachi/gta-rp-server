# Towing Job System - Current State & Improvement Suggestions

## 📋 Current System Overview

### **Core Mechanics**

- **Job Start**: Talk to NPC at HQ → Rent truck (250 deposit) → Auto-assigned first contract
- **Job Loop**:
  - Get contract location (40 random spawn points)
  - Drive to location
  - Hook up vehicle (raycast detection)
  - Deliver to dropoff location
  - Auto-assigned next contract (continuous work)
- **Payment**:
  - Base: 150-170 per vehicle
  - Bonus tiers: 5+ (5%), 10+ (7%), 15+ (10%), 20+ (12%)
  - Tax: 15% deducted
  - Paid via payslip collection at NPC
- **Truck Management**:
  - Return truck option (refunds deposit)
  - Can't start new job if truck already out
  - Truck despawns on return

### **Current Features**

✅ NPC interaction system (target/keypress)  
✅ Vehicle rental with deposit system  
✅ 40 random vehicle spawn locations  
✅ Automatic contract assignment after delivery  
✅ Blip system for navigation  
✅ Payment with bonus tiers  
✅ Crypto stick chance (26%)  
✅ Job state tracking (JobsDone counter)  
✅ React/Tailwind NUI menu  
✅ Combat controls disabled during menu

### **Current Limitations**

❌ No progression system  
❌ No experience/levels  
❌ No unlockable vehicles  
❌ No skill-based bonuses  
❌ No reputation system  
❌ No special contracts  
❌ No vehicle condition affects payment  
❌ No time-based bonuses  
❌ No streak bonuses  
❌ No achievements/milestones  
❌ Single vehicle type (flatbed)  
❌ No difficulty tiers

---

## 🚀 Suggested Improvements & Progression System

### **1. Experience & Level System**

#### **Core Progression**

- **XP Gain**:
  - Base: 10 XP per vehicle towed
  - Distance bonus: +1 XP per 0.5km traveled
  - Condition bonus: +5 XP for undamaged delivery
  - Time bonus: +3 XP for quick delivery (<5 min)
- **Level Tiers**:
  - **Level 1-5**: Rookie (0-500 XP)
  - **Level 6-10**: Apprentice (501-1500 XP)
  - **Level 11-15**: Professional (1501-3000 XP)
  - **Level 16-20**: Expert (3001-5000 XP)
  - **Level 21+**: Master (5001+ XP)

#### **Level Benefits**

- **Payment Multipliers**:

  - Level 1-5: 1.0x (base)
  - Level 6-10: 1.1x
  - Level 11-15: 1.25x
  - Level 16-20: 1.5x
  - Level 21+: 1.75x

- **Unlockable Vehicles**:

  - Level 1: Flatbed (default)
  - Level 5: Tow Truck (smaller, faster)
  - Level 10: Heavy Duty Flatbed (can tow larger vehicles)
  - Level 15: Car Carrier (can tow 2 vehicles)
  - Level 20: Premium Tow Truck (best handling/speed)

- **Special Abilities**:
  - Level 10: Quick Hook (faster hookup animation)
  - Level 15: GPS Upgrade (shows traffic/route optimization)
  - Level 20: Auto-Hook (automatic hookup when close)

---

### **2. Reputation System**

#### **Reputation Tiers**

- **Bronze** (0-100 rep): Standard contracts
- **Silver** (101-250 rep): Access to premium contracts (+20% pay)
- **Gold** (251-500 rep): VIP contracts (+40% pay, rare vehicles)
- **Platinum** (501+ rep): Exclusive contracts (+60% pay, luxury vehicles)

#### **Reputation Gain**

- Perfect delivery (no damage): +5 rep
- Quick delivery (<5 min): +3 rep
- Long distance (>5km): +2 rep
- Streak bonus: +1 rep per consecutive delivery (max +10)

#### **Reputation Loss**

- Vehicle damage: -2 rep
- Abandoned contract: -5 rep
- Late delivery (>15 min): -1 rep

---

### **3. Contract Types & Difficulty**

#### **Standard Contracts** (Always Available)

- **Basic Tow**: Common vehicles, 150-170 base pay
- **Rush Delivery**: Time limit (10 min), +30% bonus if completed
- **Long Distance**: 5km+ distance, +50% base pay

#### **Premium Contracts** (Silver+ Reputation)

- **Luxury Vehicle**: High-end cars, +40% pay, must be careful (damage penalty)
- **Multi-Vehicle**: Tow 2-3 vehicles in sequence, +100% pay
- **Emergency Tow**: Police/EMS requested, +60% pay, priority

#### **VIP Contracts** (Gold+ Reputation)

- **Classic Car**: Rare/expensive vehicles, +80% pay, strict condition requirements
- **Heavy Duty**: Large vehicles (trucks, buses), requires Heavy Duty Flatbed, +120% pay
- **Night Shift**: Only available 22:00-06:00, +50% pay, bonus XP

#### **Exclusive Contracts** (Platinum Reputation)

- **Supercar Recovery**: Exotic vehicles, +150% pay, perfect condition required
- **Fleet Recovery**: 5+ vehicles, +200% pay, requires Car Carrier
- **Special Event**: Limited time contracts, +300% pay, unique rewards

---

### **4. Vehicle Condition System**

#### **Damage Tracking**

- Track vehicle condition when hooked
- Condition affects final payment:
  - **Perfect** (0% damage): 100% payment
  - **Good** (1-10% damage): 90% payment
  - **Fair** (11-25% damage): 75% payment
  - **Poor** (26-50% damage): 50% payment
  - **Critical** (51%+ damage): 25% payment, reputation loss

#### **Condition Bonuses**

- Perfect delivery streak: +5% bonus per consecutive perfect delivery (max +25%)
- Damage prevention: XP bonus for careful driving

---

### **5. Streak & Daily Bonuses**

#### **Streak System**

- **Daily Streak**: Consecutive days worked

  - Day 1-3: +5% pay
  - Day 4-7: +10% pay
  - Day 8-14: +15% pay
  - Day 15+: +20% pay

- **Session Streak**: Consecutive vehicles in one session
  - 5 vehicles: +10% pay
  - 10 vehicles: +20% pay
  - 15 vehicles: +30% pay
  - 20+ vehicles: +50% pay

#### **Daily Challenges**

- **Daily Goals**:
  - Tow 5 vehicles: +$200 bonus
  - Tow 10 vehicles: +$500 bonus
  - Perfect deliveries: +$300 bonus
  - Complete 3 rush deliveries: +$400 bonus

---

### **6. Special Features**

#### **Upgrades & Customization**

- **Truck Upgrades** (purchasable with job earnings):
  - Engine Tune: +10% speed
  - Suspension: Better handling
  - GPS System: Route optimization
  - Winch Upgrade: Faster hookup
  - Fuel Efficiency: -20% fuel consumption

#### **Achievement System**

- **Milestones**:
  - First Tow: Unlock achievement
  - 100 Vehicles: "Century Club"
  - 500 Vehicles: "Tow Master"
  - 1000 Vehicles: "Legendary Tower"
  - Perfect Week: 7 days, all perfect deliveries
  - Speed Demon: Complete 10 rush deliveries

#### **Leaderboards**

- Weekly/Monthly rankings:
  - Most vehicles towed
  - Highest earnings
  - Best reputation
  - Longest streak

---

### **7. Quality of Life Improvements**

#### **UI Enhancements**

- **Progress Display**: Show XP, level, reputation in menu
- **Contract Preview**: Show distance, vehicle type, estimated pay before accepting
- **Statistics Panel**: Total vehicles, earnings, perfect deliveries, etc.
- **Upgrade Shop**: Purchase upgrades from NPC menu

#### **Gameplay Enhancements**

- **Route Optimization**: Show fastest route (level 15+)
- **Weather Effects**: Rain/snow affects driving, +10% pay for difficult conditions
- **Time of Day**: Night shift bonus (22:00-06:00)
- **Vehicle Variety**: More vehicle models in spawn pool
- **Dynamic Pricing**: Pay varies by vehicle rarity/condition

---

### **8. Implementation Priority**

#### **Phase 1: Core Progression** (High Priority)

1. XP/Level system
2. Level-based payment multipliers
3. Basic reputation system
4. Vehicle condition tracking

#### **Phase 2: Content Expansion** (Medium Priority)

1. Contract types (Rush, Long Distance)
2. Streak bonuses
3. Unlockable vehicles
4. Daily challenges

#### **Phase 3: Advanced Features** (Lower Priority)

1. Premium/VIP contracts
2. Truck upgrades
3. Achievement system
4. Leaderboards

---

## 📊 Database Schema Suggestions

### **Player Towing Stats**

```lua
{
    citizenid = "string",
    level = 1,
    xp = 0,
    reputation = 0,
    totalVehicles = 0,
    totalEarnings = 0,
    perfectDeliveries = 0,
    currentStreak = 0,
    dailyStreak = 0,
    lastWorkDate = "date",
    unlockedVehicles = {"flatbed"},
    upgrades = {},
    achievements = {}
}
```

---

## 🎯 Expected Player Benefits

1. **Long-term Engagement**: Progression gives players goals to work towards
2. **Variety**: Different contract types prevent monotony
3. **Rewards**: Unlockables and bonuses reward dedication
4. **Skill Expression**: Condition system rewards careful driving
5. **Social Elements**: Leaderboards and achievements create competition
6. **Economic Balance**: Higher levels = better pay, but requires investment

---

## 💡 Additional Ideas

- **Tow Company Ownership**: High-level players can own/manage tow companies
- **Employee System**: Hire other players, take percentage of earnings
- **Special Events**: Limited-time contracts with unique rewards
- **Vehicle Customization**: Paint jobs, decals for tow trucks
- **Radio System**: In-game radio for tow operators
- **Dispatch System**: Players can request tows from other players
- **Impound System**: Towed vehicles go to impound, players can retrieve
