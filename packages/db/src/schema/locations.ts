import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";

export const locations = pgTable(
  "locations",
  {
    id: serial("id").primaryKey(),
    locationCode: integer("location_code").notNull(),
    locationName: text("location_name").notNull(),
    locationType: text("location_type").notNull(), // 'Country' | 'State' | 'City'
    countryIsoCode: text("country_iso_code").notNull(),
    parentCode: integer("parent_code"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (table) => ({
    locationCodeUnique: uniqueIndex("locations_location_code_unique").on(table.locationCode),
    typeIdx: index("idx_locations_type").on(table.locationType),
    parentIdx: index("idx_locations_parent").on(table.parentCode),
    countryIdx: index("idx_locations_country").on(table.countryIsoCode),
  })
);
