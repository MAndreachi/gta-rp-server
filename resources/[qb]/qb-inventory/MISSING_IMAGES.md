# Missing Item Images in QB-Inventory

## Summary

Some items in the inventory system are missing their image files, which causes broken image icons to appear in the inventory UI.

## Confirmed Missing Images

### 1. `cash.png`

- **Item Name:** `cash`
- **Item Label:** "Cash"
- **Location:** `resources/[qb]/qb-core/shared/items.lua` line 372
- **Status:** ❌ **MISSING** - File does not exist in `resources/[qb]/qb-inventory/html/images/`
- **Solution:** Create a `cash.png` image file (typically shows dollar bills or cash stack)

### 2. `weapon_candycane.png`

- **Item Name:** `weapon_candycane`
- **Item Label:** "Candy Cane"
- **Location:** `resources/[qb]/qb-core/shared/items.lua` line 28
- **Status:** ⚠️ **FIXED** - Image name was missing `.png` extension (now fixed in code)
- **Note:** You still need to ensure the actual image file exists

## Items That DO Have Images (Verified)

### ✅ `weapon_license.png`

- **Item Name:** `weaponlicense`
- **Status:** Image file exists

### ✅ `meth_baggy.png`

- **Item Name:** `meth`
- **Status:** Image file exists

### ✅ `armor.png`

- **Item Names:** `armor` and `heavyarmor`
- **Status:** Image file exists (both items use the same image)

## How to Fix

1. **For `cash.png`:**

   - Create a PNG image file (recommended size: 64x64 or 128x128 pixels)
   - Save it as `cash.png` in `resources/[qb]/qb-inventory/html/images/`
   - The image should represent physical cash/money

2. **For `weapon_candycane.png`:**
   - Create a PNG image file if it doesn't exist
   - Save it as `weapon_candycane.png` in `resources/[qb]/qb-inventory/html/images/`

## How Images Are Loaded

The inventory system loads images from:

- Path: `resources/[qb]/qb-inventory/html/images/`
- HTML Template: `resources/[qb]/qb-inventory/html/index.html`
- Image reference: `'images/' + item.image`

If an image file is missing, the browser will show a broken image icon.

## Additional Notes

- The `heavyarmor` item uses the same image as `armor` (`armor.png`). If you want a separate image for heavy armor, you would need to:
  1. Create a `heavyarmor.png` file
  2. Update line 353 in `resources/[qb]/qb-core/shared/items.lua` to change `image = 'armor.png'` to `image = 'heavyarmor.png'`

## Finding Other Missing Images

To check for other missing images, you can:

1. Extract all image filenames from `items.lua`
2. Check which files exist in `html/images/`
3. Compare the two lists to find missing files
