/**
 * Festival parking, as published by the Pune City Traffic Police.
 *
 * ---------------------------------------------------------------------
 * Where this came from, and what it therefore is.
 *
 * Extracted from the Traffic Police's own "Traffic Diversions and
 * Parking" map for Ganeshotsav, credited on the map itself to Traffic
 * Planner Anish Shelar, API Sachin Jadhav and PC 8952 Anant Dhavale.
 * Coordinates are theirs, taken from the map's KML rather than retyped.
 *
 * That provenance is the whole value of this file, and it sets the
 * limits too. This is a published plan, not an observation: it does not
 * say how many cars fit, whether a lot is full, whether it charges, or
 * whether it is actually open tonight. The app must not imply any of
 * those — see /parking, which states the source and the date and links
 * to the original.
 *
 * `sourceName` keeps the police map's own label verbatim, spelling and
 * all, so a tidied display name can always be checked against what was
 * published. Names were tidied for display only: "PAARKING" to
 * "Parking", "Abasahebh" to "Abasaheb", and the trailing word "Parking"
 * dropped because every row here is one.
 *
 * The numbering is the police list's own, and it has gaps: 8, 18, 23 and
 * 24 are absent from the source. They are not omitted here, they were
 * never published, and inventing them to make the list run 1 to 27 would
 * be inventing parking.
 *
 * Five entries are stretches of road rather than yards. Their pin is the
 * midpoint of the line the police drew, which is why `kind` exists: a
 * visitor should be told to look along a road, not sent to one point on
 * it.
 *
 * The same source map carries road closures and diversion points. They
 * are deliberately not in this file yet — a closure shown a day late or
 * a junction described loosely is worse than sending someone to Google
 * Maps, and they need their own treatment.
 */

/** Where the data came from. Shown to visitors, not just recorded here. */
export const PARKING_SOURCE = {
  title: 'Traffic Diversions and Parking',
  authority: 'Pune City Traffic Police',
  credit: 'Traffic Planner Anish Shelar, API Sachin Jadhav, PC 8952 Anant Dhavale',
  url: 'https://maps.app.goo.gl/QsVJDGBGYvep1vMUA',
  /** When this file was taken from that map. */
  captured: '2026-09-13',
} as const;

export type ParkingKind =
  /** A yard, ground or building where you park. */
  | 'lot'
  /** A length of road set aside for parking; look along it. */
  | 'stretch';

export interface ParkingSpot {
  /** The police list's own number. Gaps are theirs. */
  no: number;
  name: string;
  /** The source map's label, verbatim. */
  sourceName: string;
  kind: ParkingKind;
  lat: number;
  lng: number;
}

export const PARKING: ParkingSpot[] = [
  { no: 1, name: "New English School, Ramanbaug", sourceName: "1. New English School Ramanbaugh Parking", kind: 'lot', lat: 18.517189, lng: 73.849662 },
  { no: 2, name: "Shivaji Akhada", sourceName: "2. Shivaji Akhada Parking", kind: 'lot', lat: 18.523471, lng: 73.851018 },
  { no: 3, name: "H. V. Desai College", sourceName: "3. HV Desai College Parking", kind: 'lot', lat: 18.51836, lng: 73.855507 },
  { no: 4, name: "Hamalwada", sourceName: "4. Hamalwada PAARKING", kind: 'lot', lat: 18.514963, lng: 73.851185 },
  { no: 5, name: "Gogte Prashala", sourceName: "5. Gogte prashala parking", kind: 'lot', lat: 18.515076, lng: 73.846975 },
  { no: 6, name: "SSPMS, Shivajinagar", sourceName: "6. SSPMS Shivajinagar Parking", kind: 'lot', lat: 18.526296, lng: 73.85316 },
  { no: 7, name: "S. P. College", sourceName: "7. SP College Parking", kind: 'lot', lat: 18.507662, lng: 73.849591 },
  { no: 9, name: "Peshwe Park, Sarasbaug", sourceName: "9. Peshwe Park Sarasbaugh Parking", kind: 'lot', lat: 18.502302, lng: 73.852263 },
  { no: 10, name: "Harjeevan Hospital, Sarasbaug", sourceName: "10. Harjeevan Hospital Sarasbaugh parking", kind: 'lot', lat: 18.500549, lng: 73.854153 },
  { no: 11, name: "Patil Plaza", sourceName: "11. Patil Plaza Parking", kind: 'lot', lat: 18.498355, lng: 73.854387 },
  { no: 12, name: "Parvati to Dandekar Pool", sourceName: "12. Parvati to dandekar pool parking", kind: 'stretch', lat: 18.50068, lng: 73.848974 },
  { no: 13, name: "Dandekar Pool to Ganesh Mala", sourceName: "13. Dandekar to ganesh mala", kind: 'stretch', lat: 18.499282, lng: 73.84285 },
  { no: 14, name: "Ganesh Mala to Rajaram Bridge", sourceName: "14. Ganeshmala to Rajaram Parking", kind: 'stretch', lat: 18.490282, lng: 73.832225 },
  { no: 15, name: "Nilayam Talkies", sourceName: "15. Nilayam Talkies Parking", kind: 'lot', lat: 18.502891, lng: 73.850728 },
  { no: 16, name: "Vimlabai Garware", sourceName: "16. Vimlabai Garware Parking", kind: 'lot', lat: 18.513897, lng: 73.840573 },
  { no: 17, name: "Abasaheb Garware College", sourceName: "17. Abasahebh Garware Parking", kind: 'lot', lat: 18.51188, lng: 73.838609 },
  { no: 19, name: "Apte Prashala", sourceName: "19. Apte Prashala Parking", kind: 'lot', lat: 18.518382, lng: 73.84308 },
  { no: 20, name: "Fergusson College", sourceName: "20. Fergusson College Parking", kind: 'lot', lat: 18.522984, lng: 73.840116 },
  { no: 21, name: "Jain Hostel, BMCC Road", sourceName: "21. Jain Hostel BMCC ROAD Parking", kind: 'lot', lat: 18.521713, lng: 73.833729 },
  { no: 22, name: "MMCOE", sourceName: "22. MMCOE Parking", kind: 'lot', lat: 18.520805, lng: 73.839197 },
  { no: 25, name: "Congress House Road", sourceName: "25. Congress House rd Parking", kind: 'stretch', lat: 18.522566, lng: 73.852678 },
  { no: 26, name: "New English School", sourceName: "26. New English School Parking", kind: 'lot', lat: 18.511273, lng: 73.845262 },
  { no: 27, name: "Nadipatra, Bhide Pool to Gadgil Pool", sourceName: "27. Nadipatra bhide pool gadgil pool Parking", kind: 'stretch', lat: 18.515208, lng: 73.843741 },
];
