import React, { useState, useMemo, useEffect } from "react";
import logo from "./assets/logo-horizontal.svg";

if (typeof window !== "undefined" && !window.storage) {
  window.storage = {
    get: async (k) => {
      const v = localStorage.getItem(k);
      return v === null ? null : { key: k, value: v };
    },
    set: async (k, v) => { localStorage.setItem(k, v); return { key: k, value: v }; },
    delete: async (k) => { localStorage.removeItem(k); return { key: k, deleted: true }; },
    list: async (p = "") => ({ keys: Object.keys(localStorage).filter(k => k.startsWith(p)) }),
  };
}

/* ============================================================
   WAR ROOM
   Draft assistant (Quick Play)

   Ratings are ESTIMATES modeled on the game's stated method
   (era-adjusted Approximate Value, peak-weighted). They are not
   the game's real numbers. Feed in logged picks to calibrate.
   ============================================================ */

// [name, firstYearWithTeam, lastYearWithTeam, estimatedRating]
const TEAMS = {
  ari: { name: "Cardinals", color: "#97233F", p: {
    QB: [["Jim Hart",1966,1983,72],["Kurt Warner",2005,2009,88],["Kyler Murray",2019,2025,75]],
    RB: [["Ottis Anderson",1979,1986,76],["Edgerrin James",2006,2008,70],["David Johnson",2015,2019,71]],
    WR: [["Roy Green",1979,1990,76],["Anquan Boldin",2003,2009,82],["Larry Fitzgerald",2004,2020,95]],
    TE: [["Jackie Smith",1963,1977,82],["Freddie Jones",2002,2004,56],["Zach Ertz",2021,2023,70]],
    F7: [["Eric Swann",1991,1999,72],["Simeon Rice",1996,2000,78],["Calais Campbell",2008,2016,89.3],["Chandler Jones",2016,2021,84]],
    DB: [["Larry Wilson",1960,1972,96.3],["Aeneas Williams",1991,2000,85],["Patrick Peterson",2011,2020,84],["Budda Baker",2017,2025,78]] } },
  atl: { name: "Falcons", color: "#A71930", p: {
    QB: [["Steve Bartkowski",1975,1985,74],["Michael Vick",2001,2006,80],["Matt Ryan",2008,2021,89]],
    RB: [["Gerald Riggs",1982,1988,72],["Warrick Dunn",2002,2007,75],["Devonta Freeman",2014,2019,70],["Bijan Robinson",2023,2025,72]],
    WR: [["Andre Rison",1990,1994,74],["Roddy White",2005,2015,83],["Julio Jones",2011,2020,96.7],["Drake London",2022,2025,68]],
    TE: [["Jim Mitchell",1969,1979,68],["Alge Crumpler",2001,2007,74],["Tony Gonzalez",2009,2013,85],["Kyle Pitts",2021,2025,62]],
    F7: [["Claude Humphrey",1968,1978,88],["John Abraham",2006,2012,82],["Grady Jarrett",2015,2024,76]],
    DB: [["Rolland Lawrence",1973,1980,72],["Deion Sanders",1989,1993,90],["Ray Buchanan",1997,2003,74],["A.J. Terrell",2020,2025,68]] } },
  bal: { name: "Ravens", color: "#241773", p: {
    QB: [["Joe Flacco",2008,2018,78],["Lamar Jackson",2018,2025,92]],
    RB: [["Jamal Lewis",2000,2006,77],["Ray Rice",2008,2013,72],["Derrick Henry",2024,2025,80]],
    WR: [["Derrick Mason",2005,2010,72],["Anquan Boldin",2010,2012,72],["Zay Flowers",2023,2025,68]],
    TE: [["Todd Heap",2001,2010,76],["Dennis Pitta",2010,2016,60],["Mark Andrews",2018,2025,80]],
    F7: [["Ray Lewis",1996,2012,98.5],["Terrell Suggs",2003,2018,88],["Haloti Ngata",2006,2014,80],["Roquan Smith",2022,2025,76]],
    DB: [["Rod Woodson",1998,2001,78],["Ed Reed",2002,2012,99.3],["Marlon Humphrey",2017,2025,76]] } },
  buf: { name: "Bills", color: "#00338D", p: {
    QB: [["Jim Kelly",1986,1996,88],["Drew Bledsoe",2002,2004,68],["Josh Allen",2018,2025,92]],
    RB: [["O.J. Simpson",1969,1977,92],["Thurman Thomas",1988,1999,89],["LeSean McCoy",2015,2018,74],["James Cook",2022,2025,66]],
    WR: [["Andre Reed",1985,1999,86],["Eric Moulds",1996,2005,76],["Stefon Diggs",2020,2023,82]],
    TE: [["Pete Metzelaars",1985,1994,62],["Jay Riemersma",1997,2002,58],["Dawson Knox",2019,2025,60]],
    F7: [["Bruce Smith",1985,1999,99.4],["Cornelius Bennett",1987,1995,80],["Ed Oliver",2019,2025,68],["Von Miller",2022,2024,64]],
    DB: [["Butch Byrd",1964,1970,72],["Henry Jones",1991,2000,68],["Jairus Byrd",2009,2013,72],["Tre'Davious White",2017,2023,76]] } },
  car: { name: "Panthers", color: "#0085CA", p: {
    QB: [["Jake Delhomme",2003,2009,70],["Cam Newton",2011,2019,86],["Bryce Young",2023,2025,58]],
    RB: [["DeAngelo Williams",2006,2014,72],["Jonathan Stewart",2008,2017,68],["Christian McCaffrey",2017,2022,82]],
    WR: [["Muhsin Muhammad",1996,2004,76],["Steve Smith Sr.",2001,2013,88],["D.J. Moore",2018,2022,72]],
    TE: [["Wesley Walls",1996,2002,74],["Greg Olsen",2011,2019,80]],
    F7: [["Julius Peppers",2002,2009,90],["Kris Jenkins",2001,2007,76],["Luke Kuechly",2012,2019,86],["Thomas Davis",2005,2018,76]],
    DB: [["Mike Minter",1997,2006,70],["Chris Gamble",2004,2012,66],["Josh Norman",2012,2015,68],["Jaycee Horn",2021,2025,68]] } },
  chi: { name: "Bears", color: "#0B162A", p: {
    QB: [["Sid Luckman",1939,1950,85],["Jim McMahon",1982,1988,70],["Justin Fields",2021,2023,62],["Caleb Williams",2024,2025,60]],
    RB: [["Walter Payton",1975,1987,97],["Gale Sayers",1965,1971,86],["Neal Anderson",1986,1993,70],["Matt Forte",2008,2015,78]],
    WR: [["Harlon Hill",1954,1961,72],["Marty Booker",1999,2003,64],["Brandon Marshall",2012,2014,72],["Alshon Jeffery",2012,2016,68],["D.J. Moore",2023,2025,70]],
    TE: [["Mike Ditka",1961,1966,96.1],["Greg Olsen",2007,2010,64],["Cole Kmet",2020,2025,58]],
    F7: [["Dick Butkus",1965,1973,98.7],["Mike Singletary",1981,1992,90],["Richard Dent",1983,1993,88],["Khalil Mack",2018,2021,82]],
    DB: [["Gary Fencik",1976,1987,74],["Mike Brown",2000,2008,66],["Charles Tillman",2003,2014,78],["Eddie Jackson",2017,2022,66]] } },
  cin: { name: "Bengals", color: "#FB4F14", p: {
    QB: [["Ken Anderson",1971,1986,84],["Boomer Esiason",1984,1997,78],["Carson Palmer",2004,2010,74],["Joe Burrow",2020,2025,85]],
    RB: [["James Brooks",1984,1991,74],["Corey Dillon",1997,2003,76],["Joe Mixon",2017,2023,70]],
    WR: [["Isaac Curtis",1973,1984,74],["Chad Johnson",2001,2010,84],["A.J. Green",2011,2019,84],["Ja'Marr Chase",2021,2025,84]],
    TE: [["Bob Trumpy",1968,1977,72],["Rodney Holman",1982,1992,65],["Tyler Eifert",2013,2019,60]],
    F7: [["Tim Krumrie",1983,1994,72],["Justin Smith",2001,2007,74],["Geno Atkins",2010,2020,90.6],["Trey Hendrickson",2021,2025,78]],
    DB: [["Ken Riley",1969,1983,91.6],["Lemar Parrish",1970,1977,74],["David Fulcher",1986,1992,72],["Jessie Bates III",2018,2022,70]] } },
  cle: { name: "Browns", color: "#311D00", p: {
    QB: [["Otto Graham",1946,1955,95],["Brian Sipe",1974,1983,74],["Bernie Kosar",1985,1993,70],["Baker Mayfield",2018,2021,62]],
    RB: [["Jim Brown",1957,1965,100],["Leroy Kelly",1964,1973,82],["Kevin Mack",1985,1993,66],["Nick Chubb",2018,2024,78]],
    WR: [["Paul Warfield",1964,1977,86],["Webster Slaughter",1986,1991,66],["Josh Gordon",2012,2014,66],["Jarvis Landry",2018,2021,68],["Amari Cooper",2022,2024,68]],
    TE: [["Ozzie Newsome",1978,1990,96.6],["David Njoku",2017,2025,66]],
    F7: [["Len Ford",1950,1957,82],["Clay Matthews Sr.",1978,1993,80],["Myles Garrett",2017,2025,92]],
    DB: [["Thom Darden",1972,1981,68],["Hanford Dixon",1981,1989,70],["Frank Minnifield",1984,1992,70],["Denzel Ward",2018,2025,74]] } },
  dal: { name: "Cowboys", color: "#003594", p: {
    QB: [["Roger Staubach",1969,1979,90],["Troy Aikman",1989,2000,92.2],["Tony Romo",2004,2016,78],["Dak Prescott",2016,2025,82]],
    RB: [["Tony Dorsett",1977,1987,88],["Emmitt Smith",1990,2002,95],["DeMarco Murray",2011,2014,70],["Ezekiel Elliott",2016,2022,78]],
    WR: [["Bob Hayes",1965,1974,82],["Michael Irvin",1988,1999,86],["Dez Bryant",2010,2017,78],["CeeDee Lamb",2020,2025,80]],
    TE: [["Billy Joe DuPree",1973,1983,70],["Jay Novacek",1990,1995,68],["Jason Witten",2003,2017,88]],
    F7: [["Bob Lilly",1961,1974,94],["Randy White",1975,1988,92],["DeMarcus Ware",2005,2013,95.4],["Micah Parsons",2021,2025,85]],
    DB: [["Mel Renfro",1964,1977,86],["Darren Woodson",1992,2003,80],["Deion Sanders",1995,1999,82],["Trevon Diggs",2020,2025,66]] } },
  den: { name: "Broncos", color: "#FB4F14", p: {
    QB: [["Craig Morton",1977,1982,64],["John Elway",1983,1998,94],["Jake Plummer",2003,2006,65],["Peyton Manning",2012,2015,88]],
    RB: [["Floyd Little",1967,1975,76],["Terrell Davis",1995,2001,82],["Clinton Portis",2002,2003,68],["Javonte Williams",2021,2024,58]],
    WR: [["Lionel Taylor",1960,1966,76],["Rod Smith",1995,2006,80],["Demaryius Thomas",2010,2018,80],["Courtland Sutton",2018,2025,66]],
    TE: [["Riley Odoms",1972,1983,72],["Shannon Sharpe",1990,2003,97.7],["Julius Thomas",2011,2014,58]],
    F7: [["Randy Gradishar",1974,1983,84],["Karl Mecklenburg",1983,1994,78],["Elvis Dumervil",2006,2012,74],["Von Miller",2011,2021,92]],
    DB: [["Louis Wright",1975,1986,78],["Steve Atwater",1989,1998,82],["Champ Bailey",2004,2013,88],["Patrick Surtain II",2021,2025,76]] } },
  det: { name: "Lions", color: "#0076B6", p: {
    QB: [["Bobby Layne",1950,1958,80],["Erik Kramer",1991,1993,56],["Matthew Stafford",2009,2020,85],["Jared Goff",2021,2025,78]],
    RB: [["Billy Sims",1980,1984,72],["Barry Sanders",1989,1998,99.7],["Kevin Jones",2004,2008,56],["Jahmyr Gibbs",2023,2025,72]],
    WR: [["Herman Moore",1991,2001,78],["Johnnie Morton",1994,2001,62],["Calvin Johnson",2007,2015,98.6],["Amon-Ra St. Brown",2021,2025,80]],
    TE: [["Charlie Sanders",1968,1977,80],["Brandon Pettigrew",2009,2016,56],["Sam LaPorta",2023,2025,66]],
    F7: [["Alex Karras",1958,1970,86],["Chris Spielman",1988,1995,76],["Ndamukong Suh",2010,2014,82],["Aidan Hutchinson",2022,2025,76]],
    DB: [["Yale Lary",1952,1964,82],["Lem Barney",1967,1977,84],["Dick LeBeau",1959,1972,80],["Darius Slay",2013,2019,74]] } },
  gb: { name: "Packers", color: "#203731", p: {
    QB: [["Bart Starr",1956,1971,86],["Brett Favre",1992,2007,92],["Aaron Rodgers",2005,2022,98],["Jordan Love",2023,2025,66]],
    RB: [["Jim Taylor",1958,1966,84],["Dorsey Levens",1994,2001,62],["Ahman Green",2000,2009,74],["Aaron Jones",2017,2023,70]],
    WR: [["Don Hutson",1935,1945,94],["James Lofton",1978,1986,82],["Sterling Sharpe",1988,1994,80],["Donald Driver",1999,2012,74],["Davante Adams",2014,2021,88]],
    TE: [["Paul Coffman",1978,1985,66],["Mark Chmura",1993,1999,58],["Jermichael Finley",2008,2013,60]],
    F7: [["Ray Nitschke",1958,1972,88],["Willie Davis",1960,1969,86],["Reggie White",1993,1998,90],["Clay Matthews III",2009,2018,82]],
    DB: [["Herb Adderley",1961,1969,84],["Willie Wood",1960,1971,84],["LeRoy Butler",1990,2001,80],["Charles Woodson",2006,2012,88],["Jaire Alexander",2018,2024,70]] } },
  hou: { name: "Texans", color: "#03202F", p: {
    QB: [["Matt Schaub",2007,2013,68],["Deshaun Watson",2017,2020,76],["C.J. Stroud",2023,2025,72]],
    RB: [["Domanick Williams",2003,2005,58],["Arian Foster",2009,2015,76],["Joe Mixon",2024,2025,60]],
    WR: [["Andre Johnson",2003,2014,88],["DeAndre Hopkins",2013,2019,85],["Nico Collins",2021,2025,68]],
    TE: [["Owen Daniels",2006,2013,66],["Dalton Schultz",2023,2025,56]],
    F7: [["Mario Williams",2006,2011,78],["J.J. Watt",2011,2020,99.2],["Whitney Mercilus",2012,2021,66],["Will Anderson Jr.",2023,2025,70]],
    DB: [["Dunta Robinson",2004,2009,64],["Johnathan Joseph",2011,2016,70],["Derek Stingley Jr.",2022,2025,72]] } },
  ind: { name: "Colts", color: "#002C5F", p: {
    QB: [["Johnny Unitas",1956,1972,94],["Bert Jones",1973,1981,70],["Peyton Manning",1998,2010,98],["Andrew Luck",2012,2018,78]],
    RB: [["Lenny Moore",1956,1967,86],["Eric Dickerson",1987,1991,70],["Marshall Faulk",1994,1998,80],["Edgerrin James",1999,2005,82],["Jonathan Taylor",2021,2025,76]],
    WR: [["Raymond Berry",1955,1967,84],["Marvin Harrison",1996,2008,92],["Reggie Wayne",2001,2014,86],["T.Y. Hilton",2012,2021,74]],
    TE: [["John Mackey",1963,1971,84],["Ken Dilger",1995,2001,58],["Dallas Clark",2003,2011,72]],
    F7: [["Gino Marchetti",1953,1966,90],["Dwight Freeney",2002,2012,86],["Robert Mathis",2003,2016,82],["DeForest Buckner",2020,2025,76]],
    DB: [["Bobby Boyd",1960,1968,76],["Ray Buchanan",1993,1996,58],["Bob Sanders",2004,2010,68],["Kenny Moore II",2017,2025,64]] } },
  jax: { name: "Jaguars", color: "#006778", p: {
    QB: [["Mark Brunell",1995,2003,74],["David Garrard",2002,2010,62],["Trevor Lawrence",2021,2025,68]],
    RB: [["Fred Taylor",1998,2008,80],["Maurice Jones-Drew",2006,2013,86.6],["Travis Etienne",2021,2025,62]],
    WR: [["Jimmy Smith",1995,2005,88.1],["Keenan McCardell",1996,2001,70],["Allen Robinson",2014,2017,66],["Brian Thomas Jr.",2024,2025,66]],
    TE: [["Kyle Brady",1999,2006,56],["Marcedes Lewis",2007,2017,62],["Evan Engram",2022,2024,62]],
    F7: [["Tony Brackens",1996,2003,68],["John Henderson",2002,2009,68],["Calais Campbell",2017,2019,74],["Josh Allen",2019,2025,74]],
    DB: [["Donovin Darius",1998,2006,62],["Rashean Mathis",2003,2013,68],["Jalen Ramsey",2016,2019,76]] } },
  kc: { name: "Chiefs", color: "#E31837", p: {
    QB: [["Len Dawson",1962,1975,86],["Trent Green",2001,2006,70],["Alex Smith",2013,2017,66],["Patrick Mahomes",2017,2025,99]],
    RB: [["Ed Podolak",1969,1977,66],["Priest Holmes",2001,2007,80],["Larry Johnson",2003,2009,72],["Jamaal Charles",2008,2016,80],["Isiah Pacheco",2022,2025,58]],
    WR: [["Otis Taylor",1965,1975,78],["Dwayne Bowe",2007,2014,68],["Tyreek Hill",2016,2021,94.6],["Rashee Rice",2023,2025,60]],
    TE: [["Fred Arbanas",1962,1970,70],["Tony Gonzalez",1997,2008,99.4],["Travis Kelce",2013,2025,92]],
    F7: [["Buck Buchanan",1963,1975,86],["Bobby Bell",1963,1974,86],["Willie Lanier",1967,1977,86],["Derrick Thomas",1989,1999,90],["Neil Smith",1988,1996,78],["Chris Jones",2016,2025,84]],
    DB: [["Johnny Robinson",1960,1971,82],["Emmitt Thomas",1966,1978,80],["Eric Berry",2010,2018,74],["Trent McDuffie",2022,2025,68]] } },
  lac: { name: "Chargers", color: "#0080C6", p: {
    QB: [["John Hadl",1962,1972,76],["Dan Fouts",1973,1987,90],["Philip Rivers",2004,2019,88],["Justin Herbert",2020,2025,82]],
    RB: [["Paul Lowe",1960,1968,72],["Natrone Means",1993,1999,58],["LaDainian Tomlinson",2001,2009,92],["Austin Ekeler",2017,2022,68]],
    WR: [["Lance Alworth",1962,1970,98],["Charlie Joiner",1976,1986,78],["Vincent Jackson",2005,2011,70],["Keenan Allen",2013,2023,82]],
    TE: [["Kellen Winslow",1979,1987,88],["Antonio Gates",2003,2018,98.3]],
    F7: [["Leslie O'Neal",1986,1995,78],["Junior Seau",1990,2002,94],["Shawne Merriman",2005,2010,70],["Joey Bosa",2016,2024,78]],
    DB: [["Gill Byrd",1983,1992,72],["Rodney Harrison",1994,2002,76],["Eric Weddle",2007,2015,76],["Derwin James",2018,2025,76]] } },
  lar: { name: "Rams", color: "#003594", p: {
    QB: [["Norm Van Brocklin",1949,1957,80],["Roman Gabriel",1962,1972,74],["Kurt Warner",1998,2003,86],["Matthew Stafford",2021,2025,78]],
    RB: [["Eric Dickerson",1983,1987,88],["Marshall Faulk",1999,2005,98.3],["Steven Jackson",2004,2012,78],["Todd Gurley",2015,2019,74]],
    WR: [["Elroy Hirsch",1949,1957,80],["Henry Ellard",1983,1993,76],["Isaac Bruce",1994,2007,86],["Torry Holt",1999,2008,86],["Cooper Kupp",2017,2024,80]],
    TE: [["Bob Klein",1969,1976,54],["Charle Young",1977,1979,56],["Tyler Higbee",2016,2025,60]],
    F7: [["Deacon Jones",1961,1971,94],["Merlin Olsen",1962,1976,92],["Jack Youngblood",1971,1984,88],["Kevin Greene",1985,1992,80],["Aaron Donald",2014,2023,99.6]],
    DB: [["Eddie Meador",1959,1970,76],["Nolan Cromwell",1977,1987,74],["Aeneas Williams",2001,2004,70],["Jalen Ramsey",2019,2022,76]] } },
  lv: { name: "Raiders", color: "#000000", p: {
    QB: [["Daryle Lamonica",1967,1974,76],["Ken Stabler",1970,1979,82],["Rich Gannon",1999,2004,78],["Derek Carr",2014,2022,70]],
    RB: [["Mark van Eeghen",1974,1981,66],["Marcus Allen",1982,1992,84],["Bo Jackson",1987,1990,72],["Josh Jacobs",2019,2023,70]],
    WR: [["Fred Biletnikoff",1965,1978,82],["Cliff Branch",1972,1985,80],["Tim Brown",1988,2003,93.2],["Amari Cooper",2015,2018,66],["Davante Adams",2022,2024,76]],
    TE: [["Dave Casper",1974,1980,80],["Todd Christensen",1979,1988,76],["Darren Waller",2018,2022,66],["Brock Bowers",2024,2025,72]],
    F7: [["Ted Hendricks",1975,1983,86],["Howie Long",1981,1993,86],["Khalil Mack",2014,2017,84],["Maxx Crosby",2019,2025,80]],
    DB: [["Willie Brown",1967,1978,84],["Lester Hayes",1977,1986,80],["Mike Haynes",1983,1989,80],["Charles Woodson",1998,2005,98.5]] } },
  mia: { name: "Dolphins", color: "#008E97", p: {
    QB: [["Bob Griese",1967,1980,82],["Dan Marino",1983,1999,96],["Ryan Tannehill",2012,2018,64],["Tua Tagovailoa",2020,2025,72]],
    RB: [["Larry Csonka",1968,1979,80],["Mercury Morris",1969,1975,66],["Ricky Williams",2002,2010,74],["De'Von Achane",2023,2025,66]],
    WR: [["Paul Warfield",1970,1974,78],["Mark Clayton",1983,1992,76],["Mark Duper",1982,1992,74],["Jarvis Landry",2014,2017,66],["Tyreek Hill",2022,2025,82]],
    TE: [["Bruce Hardy",1978,1989,54],["Randy McMichael",2002,2006,58],["Mike Gesicki",2018,2022,56]],
    F7: [["Nick Buoniconti",1969,1976,84],["Bill Stanfill",1969,1976,76],["Zach Thomas",1996,2007,84],["Jason Taylor",1997,2011,94.2],["Christian Wilkins",2019,2023,66]],
    DB: [["Dick Anderson",1968,1977,76],["Jake Scott",1970,1975,74],["Sam Madison",1997,2005,72],["Xavien Howard",2016,2023,74]] } },
  min: { name: "Vikings", color: "#4F2683", p: {
    QB: [["Fran Tarkenton",1961,1978,90],["Daunte Culpepper",1999,2005,74],["Kirk Cousins",2018,2023,72],["J.J. McCarthy",2024,2025,54]],
    RB: [["Chuck Foreman",1973,1979,76],["Robert Smith",1993,2000,72],["Adrian Peterson",2007,2016,98],["Dalvin Cook",2017,2022,72]],
    WR: [["Anthony Carter",1985,1993,74],["Cris Carter",1990,2001,88],["Randy Moss",1998,2004,94],["Justin Jefferson",2020,2025,88]],
    TE: [["Steve Jordan",1982,1994,72],["Kyle Rudolph",2011,2020,64],["T.J. Hockenson",2022,2025,66]],
    F7: [["Alan Page",1967,1978,92],["Carl Eller",1964,1978,88],["John Randle",1990,2000,86],["Chris Doleman",1985,1993,84],["Jared Allen",2008,2013,82],["Danielle Hunter",2015,2023,76]],
    DB: [["Paul Krause",1968,1979,84],["Bobby Bryant",1968,1980,68],["Antoine Winfield",2004,2012,72],["Harrison Smith",2012,2024,78]] } },
  ne: { name: "Patriots", color: "#002244", p: {
    QB: [["Steve Grogan",1975,1990,72],["Drew Bledsoe",1993,2001,74],["Tom Brady",2000,2019,100],["Drake Maye",2024,2025,62]],
    RB: [["Jim Nance",1965,1971,66],["Sam Cunningham",1973,1982,70],["Curtis Martin",1995,1997,68],["Corey Dillon",2004,2006,66],["Rhamondre Stevenson",2021,2025,58]],
    WR: [["Stanley Morgan",1977,1989,78],["Troy Brown",1993,2007,66],["Randy Moss",2007,2010,80],["Wes Welker",2007,2012,78],["Julian Edelman",2009,2020,76]],
    TE: [["Russ Francis",1975,1988,74],["Ben Coates",1991,1999,78],["Rob Gronkowski",2010,2018,92]],
    F7: [["Andre Tippett",1982,1993,86],["Willie McGinest",1994,2005,76],["Mike Vrabel",2001,2008,72],["Vince Wilfork",2004,2014,78],["Matthew Judon",2021,2024,66]],
    DB: [["Raymond Clayborn",1977,1989,74],["Ty Law",1995,2004,82],["Rodney Harrison",2003,2008,74],["Devin McCourty",2010,2022,90.4],["Stephon Gilmore",2017,2020,76]] } },
  no: { name: "Saints", color: "#D3BC8D", p: {
    QB: [["Archie Manning",1971,1982,74],["Aaron Brooks",2000,2005,62],["Drew Brees",2006,2020,96]],
    RB: [["George Rogers",1981,1984,68],["Deuce McAllister",2001,2008,72],["Mark Ingram",2011,2019,68],["Alvin Kamara",2017,2025,80]],
    WR: [["Eric Martin",1985,1993,72],["Joe Horn",2000,2006,74],["Marques Colston",2006,2015,76],["Michael Thomas",2016,2022,78],["Chris Olave",2022,2025,64]],
    TE: [["Henry Childs",1974,1980,52],["Hoby Brenner",1981,1993,54],["Jimmy Graham",2010,2014,78]],
    F7: [["Rickey Jackson",1981,1993,86],["Pat Swilling",1986,1992,80],["Sam Mills",1986,1994,80],["Cameron Jordan",2011,2024,84]],
    DB: [["Dave Waymer",1980,1989,64],["Sammy Knight",1997,2002,64],["Malcolm Jenkins",2009,2013,66],["Marshon Lattimore",2017,2024,72]] } },
  nyg: { name: "Giants", color: "#0B2265", p: {
    QB: [["Charlie Conerly",1948,1961,72],["Y.A. Tittle",1961,1964,76],["Phil Simms",1979,1993,78],["Eli Manning",2004,2019,82]],
    RB: [["Frank Gifford",1952,1964,82],["Joe Morris",1982,1988,66],["Rodney Hampton",1990,1997,66],["Tiki Barber",1997,2006,80],["Saquon Barkley",2018,2023,76]],
    WR: [["Homer Jones",1964,1969,72],["Amani Toomer",1996,2008,72],["Plaxico Burress",2005,2008,66],["Odell Beckham Jr.",2014,2018,81.7],["Malik Nabers",2024,2025,66]],
    TE: [["Mark Bavaro",1985,1990,74],["Jeremy Shockey",2002,2007,72],["Evan Engram",2017,2021,62]],
    F7: [["Andy Robustelli",1956,1964,82],["Sam Huff",1956,1963,80],["Lawrence Taylor",1981,1993,98],["Harry Carson",1976,1988,80],["Michael Strahan",1993,2007,90],["Justin Tuck",2005,2013,72]],
    DB: [["Emlen Tunnell",1948,1958,86],["Carl Lockhart",1965,1975,66],["Jason Sehorn",1994,2002,64],["Landon Collins",2015,2018,68]] } },
  nyj: { name: "Jets", color: "#125740", p: {
    QB: [["Joe Namath",1965,1976,84],["Ken O'Brien",1984,1992,66],["Chad Pennington",2000,2007,66],["Aaron Rodgers",2023,2024,58]],
    RB: [["Emerson Boozer",1966,1975,64],["Freeman McNeil",1981,1992,74],["Curtis Martin",1998,2005,84],["Breece Hall",2022,2025,62]],
    WR: [["Don Maynard",1960,1972,93.8],["Al Toon",1985,1992,72],["Wayne Chrebet",1995,2005,68],["Garrett Wilson",2022,2025,68]],
    TE: [["Mickey Shuler",1978,1989,62],["Dustin Keller",2008,2012,56],["Tyler Conklin",2022,2024,54]],
    F7: [["Joe Klecko",1977,1987,82],["Mark Gastineau",1979,1988,80],["John Abraham",2000,2005,74],["Quinnen Williams",2019,2025,74]],
    DB: [["Bill Baird",1963,1969,64],["Victor Green",1993,2001,60],["Darrelle Revis",2007,2016,98.1],["Sauce Gardner",2022,2025,74]] } },
  phi: { name: "Eagles", color: "#004C54", p: {
    QB: [["Sonny Jurgensen",1957,1963,70],["Randall Cunningham",1985,1995,82],["Donovan McNabb",1999,2009,84],["Jalen Hurts",2020,2025,82]],
    RB: [["Steve Van Buren",1944,1951,84],["Wilbert Montgomery",1977,1984,74],["Brian Westbrook",2002,2009,76],["LeSean McCoy",2009,2014,78],["Saquon Barkley",2024,2025,76]],
    WR: [["Tommy McDonald",1957,1963,78],["Harold Carmichael",1971,1983,82],["DeSean Jackson",2008,2013,70],["A.J. Brown",2022,2025,76]],
    TE: [["Pete Retzlaff",1956,1966,74],["Chad Lewis",1997,2004,58],["Zach Ertz",2013,2020,76],["Dallas Goedert",2018,2025,64]],
    F7: [["Chuck Bednarik",1949,1962,88],["Reggie White",1985,1992,94],["Bill Bergey",1974,1980,78],["Jerome Brown",1987,1991,70],["Trent Cole",2005,2014,72],["Fletcher Cox",2012,2023,80]],
    DB: [["Bill Bradley",1969,1976,74],["Eric Allen",1988,1994,76],["Brian Dawkins",1996,2008,88],["Darius Slay",2020,2024,70]] } },
  pit: { name: "Steelers", color: "#FFB612", p: {
    QB: [["Terry Bradshaw",1970,1983,84],["Kordell Stewart",1995,2002,62],["Ben Roethlisberger",2004,2021,88]],
    RB: [["John Henry Johnson",1960,1965,70],["Franco Harris",1972,1983,84],["Jerome Bettis",1996,2005,82],["Le'Veon Bell",2013,2017,76],["Najee Harris",2021,2024,60]],
    WR: [["Lynn Swann",1974,1982,76],["John Stallworth",1974,1987,80],["Hines Ward",1998,2011,82],["Antonio Brown",2010,2018,88]],
    TE: [["Elbie Nickel",1947,1957,68],["Eric Green",1990,1994,64],["Heath Miller",2005,2015,74],["Pat Freiermuth",2021,2025,58]],
    F7: [["Ernie Stautner",1950,1963,84],["Joe Greene",1969,1981,96],["Jack Ham",1971,1982,90],["Jack Lambert",1974,1984,90],["Greg Lloyd",1988,1997,74],["James Harrison",2004,2017,80],["Cam Heyward",2011,2025,80],["T.J. Watt",2017,2025,88]],
    DB: [["Jack Butler",1951,1959,78],["Mel Blount",1970,1983,88],["Donnie Shell",1974,1987,80],["Rod Woodson",1987,1996,90],["Troy Polamalu",2003,2014,88],["Minkah Fitzpatrick",2019,2024,74]] } },
  sea: { name: "Seahawks", color: "#002244", p: {
    QB: [["Dave Krieg",1980,1991,74],["Matt Hasselbeck",2001,2010,72],["Russell Wilson",2012,2021,88],["Geno Smith",2022,2024,66]],
    RB: [["Curt Warner",1983,1989,72],["Shaun Alexander",2000,2007,76],["Marshawn Lynch",2010,2019,80],["Kenneth Walker III",2022,2025,62]],
    WR: [["Steve Largent",1976,1989,97.7],["Brian Blades",1988,1998,66],["Doug Baldwin",2011,2018,72],["Tyler Lockett",2015,2024,68],["DK Metcalf",2019,2024,74]],
    TE: [["Mike Tice",1981,1988,50],["Itula Mili",1997,2005,50],["Jimmy Graham",2015,2017,62],["Noah Fant",2022,2025,54]],
    F7: [["Jacob Green",1980,1991,76],["Cortez Kennedy",1990,2000,84],["Chad Brown",1997,2004,66],["Bobby Wagner",2012,2025,86],["Michael Bennett",2013,2017,72]],
    DB: [["Dave Brown",1976,1986,70],["Kenny Easley",1981,1987,82],["Earl Thomas",2010,2018,86],["Richard Sherman",2011,2017,84],["Kam Chancellor",2010,2017,76]] } },
  sf: { name: "49ers", color: "#AA0000", p: {
    QB: [["Y.A. Tittle",1951,1960,76],["Joe Montana",1979,1992,98.5],["Steve Young",1987,1999,92],["Jeff Garcia",1999,2003,68],["Brock Purdy",2022,2025,70]],
    RB: [["Joe Perry",1948,1963,84],["Hugh McElhenny",1952,1960,78],["Roger Craig",1983,1990,78],["Ricky Watters",1992,1994,66],["Frank Gore",2005,2014,84],["Christian McCaffrey",2022,2025,80]],
    WR: [["Dwight Clark",1979,1987,72],["Jerry Rice",1985,2000,100],["John Taylor",1987,1995,70],["Terrell Owens",1996,2003,86],["Deebo Samuel",2019,2024,72]],
    TE: [["Ted Kwalick",1969,1974,66],["Brent Jones",1987,1997,72],["Vernon Davis",2006,2015,74],["George Kittle",2017,2025,86]],
    F7: [["Dave Wilcox",1964,1974,82],["Fred Dean",1981,1985,74],["Charles Haley",1986,1991,78],["Bryant Young",1994,2007,82],["Patrick Willis",2007,2014,86],["Justin Smith",2008,2014,80],["Nick Bosa",2019,2025,84]],
    DB: [["Jimmy Johnson",1961,1976,84],["Ronnie Lott",1981,1990,94],["Eric Wright",1981,1990,68],["Merton Hanks",1991,1998,68],["Charvarius Ward",2022,2024,64]] } },
  tb: { name: "Buccaneers", color: "#D50A0A", p: {
    QB: [["Doug Williams",1978,1982,66],["Brad Johnson",2001,2004,62],["Jameis Winston",2015,2019,64],["Tom Brady",2020,2022,84],["Baker Mayfield",2023,2025,70]],
    RB: [["James Wilder",1981,1989,70],["Mike Alstott",1996,2006,68],["Warrick Dunn",1997,2001,68],["Doug Martin",2012,2017,64],["Rachaad White",2022,2025,56]],
    WR: [["Mark Carrier",1987,1992,66],["Keyshawn Johnson",2000,2003,66],["Mike Evans",2014,2025,88],["Chris Godwin",2017,2025,70]],
    TE: [["Jimmie Giles",1978,1986,70],["Rob Gronkowski",2020,2021,62],["Cade Otton",2022,2025,54]],
    F7: [["Lee Roy Selmon",1976,1984,88],["Hardy Nickerson",1993,1999,72],["Warren Sapp",1995,2003,90],["Derrick Brooks",1995,2008,90],["Simeon Rice",2001,2006,78],["Vita Vea",2018,2025,70]],
    DB: [["Cedric Brown",1977,1984,56],["John Lynch",1993,2003,80],["Ronde Barber",1997,2012,84],["Antoine Winfield Jr.",2020,2025,74]] } },
  ten: { name: "Titans / Oilers", color: "#4B92DB", p: {
    QB: [["George Blanda",1960,1966,74],["Dan Pastorini",1971,1979,66],["Warren Moon",1984,1993,86],["Steve McNair",1995,2005,82.8],["Ryan Tannehill",2019,2023,66]],
    RB: [["Earl Campbell",1978,1984,86],["Eddie George",1996,2003,78],["Chris Johnson",2008,2013,74],["Derrick Henry",2016,2023,86]],
    WR: [["Charley Hennigan",1960,1966,76],["Drew Hill",1985,1991,70],["Ernest Givins",1986,1994,70],["Derrick Mason",1997,2004,74],["A.J. Brown",2019,2021,70]],
    TE: [["Frank Wycheck",1995,2003,68],["Delanie Walker",2013,2018,70],["Jared Cook",2009,2012,56]],
    F7: [["Elvin Bethea",1968,1983,75.4],["Robert Brazile",1975,1984,82],["Ray Childress",1985,1995,78],["Jevon Kearse",1999,2003,74],["Jurrell Casey",2011,2019,76],["Harold Landry",2018,2025,64]],
    DB: [["Ken Houston",1967,1972,84],["Blaine Bishop",1993,2001,66],["Samari Rolle",1998,2004,66],["Kevin Byard",2016,2022,88.6]] } },
  was: { name: "Commanders", color: "#5A1414", p: {
    QB: [["Sammy Baugh",1937,1952,97],["Sonny Jurgensen",1964,1974,82],["Joe Theismann",1974,1985,78],["Kirk Cousins",2012,2017,68],["Jayden Daniels",2024,2025,72]],
    RB: [["Larry Brown",1969,1976,74],["John Riggins",1976,1985,78],["Stephen Davis",1996,2002,66],["Clinton Portis",2004,2010,72],["Brian Robinson Jr.",2022,2025,54]],
    WR: [["Charley Taylor",1964,1977,84],["Art Monk",1980,1993,84],["Gary Clark",1985,1992,76],["Santana Moss",2005,2014,66],["Terry McLaurin",2019,2025,72]],
    TE: [["Jerry Smith",1965,1977,76],["Chris Cooley",2004,2012,64],["Zach Ertz",2022,2023,58]],
    F7: [["Chris Hanburger",1965,1978,80],["Dexter Manley",1981,1989,74],["Charles Mann",1983,1993,72],["London Fletcher",2007,2013,76],["Ryan Kerrigan",2011,2020,74]],
    DB: [["Ken Houston",1973,1980,82],["Darrell Green",1983,2002,97.6],["Champ Bailey",1999,2003,74],["Sean Taylor",2004,2007,72]] } },
};

const SLOTS = [
  { id: "QB",  label: "QB",  pool: "QB" },
  { id: "RB",  label: "RB",  pool: "RB" },
  { id: "WR1", label: "WR1", pool: "WR" },
  { id: "WR2", label: "WR2", pool: "WR" },
  { id: "TE",  label: "TE",  pool: "TE" },
  { id: "F7A", label: "Front 7 A", pool: "F7" },
  { id: "F7B", label: "Front 7 B", pool: "F7" },
  { id: "DB",  label: "DB",  pool: "DB" },
];

const ERAS = {
  classic: { label: "Classic", sub: "pre-1995",  color: "#C8912F", lo: 1920, hi: 1994 },
  bridge:  { label: "Bridge",  sub: "1995–2009", color: "#4E9E9A", lo: 1995, hi: 2009 },
  modern:  { label: "Modern",  sub: "2010+",     color: "#5C8DEF", lo: 2010, hi: 2100 },
};
const ERA_KEYS = ["classic", "bridge", "modern"];

const DIVISIONS = [
  { label: "AFC North", teams: ["bal", "cin", "cle", "pit"] },
  { label: "AFC East",  teams: ["buf", "mia", "ne", "nyj"] },
  { label: "AFC South", teams: ["hou", "ind", "jax", "ten"] },
  { label: "AFC West",  teams: ["den", "kc", "lac", "lv"] },
  { label: "NFC North", teams: ["chi", "det", "gb", "min"] },
  { label: "NFC East",  teams: ["dal", "nyg", "phi", "was"] },
  { label: "NFC South", teams: ["atl", "car", "no", "tb"] },
  { label: "NFC West",  teams: ["ari", "lar", "sea", "sf"] },
];

// Picks black or white badge text for readable contrast against a team color.
function contrastText(hex) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#26332F" : "#F4F1E8";
}

// A player counts for an era if at least 2 seasons of his tenure fall inside it
// (or if his whole short tenure sits inside it).
function erasFor(start, end) {
  const out = [];
  for (const k of ERA_KEYS) {
    const e = ERAS[k];
    const overlap = Math.min(end, e.hi) - Math.max(start, e.lo) + 1;
    if (overlap >= 2 || (overlap >= 1 && end - start + 1 <= 2)) out.push(k);
  }
  return out;
}

function poolFor(teamKey, pool) {
  const raw = (TEAMS[teamKey]?.p?.[pool]) || [];
  return raw.map(([name, s, e, r]) => ({ name, start: s, end: e, rating: r, eras: erasFor(s, e) }));
}

function bestPlayer(teamKey, pool, era) {
  const list = poolFor(teamKey, pool).filter(p => !era || p.eras.includes(era));
  if (!list.length) return null;
  return list.reduce((a, b) => (b.rating > a.rating ? b : a));
}

// The team-grid modal, shared by the round-1 franchise picker and the
// "which team were you dealt?" picker used every round after.
function TeamPicker({ title, exclude = [], selected, onPick, onClose }) {
  return (
    <div className="modalback" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modalhead">
          <div className="eyebrow">{title}</div>
          <button type="button" className="modalclose" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="confgrid">
          {["AFC", "NFC"].map(conf => (
            <div key={conf} className="confcol">
              <div className="disp" style={{ fontSize: 17, marginBottom: 8, color: conf === "AFC" ? "#C8342B" : "#5C8DEF" }}>
                {conf}
              </div>
              {DIVISIONS.filter(div => div.label.startsWith(conf)).map(div => (
                <div key={div.label} style={{ marginBottom: 10 }}>
                  <div className="mono" style={{ fontSize: 10, color: "#859993", letterSpacing: ".08em", marginBottom: 4 }}>
                    {div.label.slice(conf.length + 1)}
                  </div>
                  <div className="teamgrid">
                    {div.teams.map(t => {
                      const disabled = exclude.includes(t);
                      return (
                        <button
                          key={t}
                          type="button"
                          disabled={disabled}
                          className={`teambadge${selected === t ? " active" : ""}`}
                          style={{ background: TEAMS[t].color, color: contrastText(TEAMS[t].color) }}
                          onClick={() => onPick(t)}
                          aria-pressed={selected === t}
                        >
                          <div className="disp" style={{ fontSize: 16 }}>{t.toUpperCase()}</div>
                          <div className="mono" style={{ fontSize: 8, opacity: .8, marginTop: 1 }}>{TEAMS[t].name}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function WarRoom() {
  const [franchise, setFranchise] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [board, setBoard] = useState({});        // slotId -> {name, team, rating, era}
  const [usedTeams, setUsedTeams] = useState([]);
  const [currentTeam, setCurrentTeam] = useState("");
  const [eraSlots, setEraSlots] = useState({});   // eraKey -> slotId (set once per board)
  const [editingLocks, setEditingLocks] = useState(false);
  const [dealtPickerOpen, setDealtPickerOpen] = useState(false);

  // --- learned data, persisted across boards -------------------------------
  const [actuals, setActuals] = useState({});     // "team|Name" -> rating the game showed
  const [extras, setExtras] = useState([]);       // players missing from the database
  const [showAdd, setShowAdd] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState("idle"); // idle | copied | failed
  const [draftForm, setDraftForm] = useState({ pool: "QB", name: "", start: "", end: "" });

  useEffect(() => {
    if (!pickerOpen && !dealtPickerOpen) return;
    const onKey = e => {
      if (e.key !== "Escape") return;
      setPickerOpen(false);
      setDealtPickerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen, dealtPickerOpen]);

  useEffect(() => {
    (async () => {
      try {
        const a = await window.storage.get("wr:actuals");
        if (a?.value) setActuals(JSON.parse(a.value));
      } catch (e) { /* first run */ }
      try {
        const x = await window.storage.get("wr:extras");
        if (x?.value) setExtras(JSON.parse(x.value));
      } catch (e) { /* first run */ }
    })();
  }, []);

  async function persist(key, val) {
    try { await window.storage.set(key, JSON.stringify(val)); } catch (e) { /* offline ok */ }
  }

  const pkey = (team, name) => `${team}|${name}`;

  // Least-squares fit of the game's real numbers against my estimates, so that
  // players you've never seen get nudged toward the game's scale too.
  const calib = useMemo(() => {
    const pts = [];
    for (const key of Object.keys(actuals)) {
      const act = Number(actuals[key]);
      if (isNaN(act)) continue;
      const [team, name] = key.split("|");
      const t = TEAMS[team];
      if (!t) continue;
      for (const poolName of Object.keys(t.p)) {
        const hit = t.p[poolName].find(r => r[0] === name);
        if (hit) pts.push({ est: hit[3], act, pool: poolName });
      }
    }
    const n = pts.length;
    if (n < 6) return { a: 1, b: 0, n, fitted: false, pts };
    const mx = pts.reduce((s, p) => s + p.est, 0) / n;
    const my = pts.reduce((s, p) => s + p.act, 0) / n;
    let num = 0, den = 0;
    for (const p of pts) { num += (p.est - mx) * (p.act - my); den += (p.est - mx) ** 2; }
    const a = den === 0 ? 1 : num / den;
    const b = my - a * mx;
    const ssRes = pts.reduce((s, p) => s + (p.act - (a * p.est + b)) ** 2, 0);
    const ssTot = pts.reduce((s, p) => s + (p.act - my) ** 2, 0);
    const r2 = ssTot === 0 ? 0 : 1 - ssRes / ssTot;
    return { a, b, n, r2, fitted: true, pts };
  }, [JSON.stringify(actuals)]);

  // A known rating always wins; otherwise fall back to the corrected estimate.
  function adjust(team, name, est) {
    const known = Number(actuals[pkey(team, name)]);
    if (!isNaN(known)) return { rating: known, known: true };
    const v = calib.fitted ? calib.a * est + calib.b : est;
    return { rating: Math.min(100, Math.max(1, Math.round(v * 10) / 10)), known: false };
  }

  function getPool(teamKey, pool) {
    const base = poolFor(teamKey, pool);
    const mine = extras
      .filter(x => x.team === teamKey && x.pool === pool)
      .map(x => ({ name: x.name, start: x.start, end: x.end, rating: x.rating,
                   eras: erasFor(x.start, x.end), custom: true }));
    const all = [...base, ...mine.filter(m => !base.some(b => b.name === m.name))];
    return all.map(p => {
      const { rating, known } = adjust(teamKey, p.name, p.rating);
      return { ...p, rating, known, est: p.rating };
    });
  }

  function getBest(teamKey, pool, era) {
    const list = getPool(teamKey, pool).filter(p => !era || p.eras.includes(era));
    if (!list.length) return null;
    return list.reduce((a, b) => (b.rating > a.rating ? b : a));
  }

  const locks = useMemo(() => {
    const out = {};
    for (const k of ERA_KEYS) if (eraSlots[k]) out[eraSlots[k]] = k;
    return out;
  }, [JSON.stringify(eraSlots)]);

  const locksValid = ERA_KEYS.every(k => eraSlots[k]) &&
    new Set(ERA_KEYS.map(k => eraSlots[k])).size === 3;

  const allTeams = Object.keys(TEAMS).sort((a, b) => TEAMS[a].name.localeCompare(TEAMS[b].name));
  const openSlots = SLOTS.filter(s => !board[s.id]);
  const remainingTeams = allTeams.filter(t => !usedTeams.includes(t) && t !== currentTeam);
  const round = usedTeams.length + 1;

  // For each slot: which of the remaining teams can legally fill it, and how good
  // the best of them tends to be. Locked slots are evaluated inside their era only.
  const outlook = useMemo(() => {
    const out = {};
    for (const s of SLOTS) {
      const era = locks[s.id] || null;
      const hits = remainingTeams
        .map(t => getBest(t, s.pool, era))
        .filter(Boolean)
        .map(p => p.rating);
      const coverage = hits.length / Math.max(remainingTeams.length, 1);
      out[s.id] = {
        era,
        count: hits.length,
        coverage,
        // conditional mean: what a future team that *can* fill this slot tends to offer
        mean: hits.length ? hits.reduce((a, b) => a + b, 0) / hits.length : 0,
      };
    }
    return out;
  }, [remainingTeams.join(","), JSON.stringify(locks), JSON.stringify(actuals), JSON.stringify(extras)]);

  // Chance a slot can still be filled if we skip it now.
  function survival(slotId, roundsLeft) {
    const p = outlook[slotId]?.coverage ?? 0;
    if (roundsLeft <= 0) return 0;
    return 1 - Math.pow(1 - p, roundsLeft);
  }

  const options = useMemo(() => {
    if (!currentTeam) return [];
    const roundsAfter = openSlots.length - 1;
    const rows = [];
    for (const s of openSlots) {
      const era = locks[s.id] || null;
      const list = getPool(currentTeam, s.pool).filter(p => !era || p.eras.includes(era));
      for (const p of list) {
        const surplus = p.rating - outlook[s.id].mean;
        // If skipping this slot risks never filling it, taking it now is worth a lot.
        // On the final pick there is no future round, so urgency is meaningless.
        const risk = roundsAfter > 0 ? (1 - survival(s.id, roundsAfter)) * 45 : 0;
        rows.push({ slot: s, player: p, era, surplus: surplus + risk, raw: surplus, risk });
      }
    }
    return rows.sort((a, b) => b.surplus - a.surplus);
  }, [currentTeam, JSON.stringify(locks), JSON.stringify(board), JSON.stringify(outlook), JSON.stringify(actuals), JSON.stringify(extras)]);

  // Open slots that are getting hard to fill, worst first.
  const endangered = useMemo(() =>
    openSlots
      .map(s => ({ slot: s, ...outlook[s.id] }))
      .filter(x => x.count <= 4)
      .sort((a, b) => a.count - b.count),
    [JSON.stringify(outlook), JSON.stringify(board)]);

  const top = options[0];
  const bestBySlot = useMemo(() => {
    const seen = new Set(); const out = [];
    for (const o of options) { if (!seen.has(o.slot.id)) { seen.add(o.slot.id); out.push(o); } }
    return out;
  }, [options]);

  const projected = useMemo(() => {
    const have = Object.values(board).reduce((a, b) => a + b.rating, 0);
    const future = openSlots.reduce((a, s) => a + outlook[s.id].mean, 0);
    return Math.round(have + future);
  }, [JSON.stringify(board), JSON.stringify(outlook)]);

  function setEraSlot(era, slotId) {
    setEraSlots(prev => {
      const next = { ...prev };
      // a slot can hold only one era
      for (const k of ERA_KEYS) if (next[k] === slotId) delete next[k];
      if (slotId) next[era] = slotId; else delete next[era];
      return next;
    });
  }

  function draft(o) {
    setBoard(prev => ({ ...prev, [o.slot.id]: {
      name: o.player.name, team: currentTeam, rating: o.player.rating,
      era: o.era, years: `${o.player.start}–${o.player.end}`,
    }}));
    setUsedTeams(prev => [...prev, currentTeam]);
    setCurrentTeam("");
    // more picks left after this one — prompt for the next dealt team
    if (openSlots.length > 1) setDealtPickerOpen(true);
  }

  function reset() {
    setFranchise(""); setStarted(false); setBoard({});
    setUsedTeams([]); setCurrentTeam(""); setEraSlots({}); setEditingLocks(false);
  }

  function undo() {
    const last = usedTeams[usedTeams.length - 1];
    if (!last) return;
    const slotId = Object.keys(board).find(k => board[k].team === last);
    setBoard(prev => { const n = { ...prev }; delete n[slotId]; return n; });
    setUsedTeams(prev => prev.slice(0, -1));
    setCurrentTeam("");
  }

  const exportText = JSON.stringify({ actuals, extras }, null, 2);

  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopyStatus("copied");
    } catch (e) {
      setCopyStatus("failed");
    }
    setTimeout(() => setCopyStatus("idle"), 2000);
  }

  const css = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@500;600&display=swap');
.wr{ background:#26332F; min-height:100vh; color:#F4F1E8;
  font-family:'IBM Plex Sans',system-ui,sans-serif; padding:14px 12px 40px; }
.wr *{ box-sizing:border-box; }
.disp{ font-family:'Barlow Condensed','Arial Narrow',sans-serif; font-weight:800;
  text-transform:uppercase; letter-spacing:.04em; line-height:.95; }
.mono{ font-family:'IBM Plex Mono',monospace; font-variant-numeric:tabular-nums; }
.eyebrow{ font-family:'Barlow Condensed',sans-serif; font-weight:600; text-transform:uppercase;
  letter-spacing:.18em; font-size:12px; color:#859993; }
.panel{ background:#30453F; border:1px solid #47665D; border-radius:4px; padding:14px; margin-bottom:12px; }
.slotgrid{ display:grid; grid-template-columns:repeat(4,1fr); gap:6px; }
.slotbtn{ background:#26332F; border:1px solid #47665D; border-radius:3px; padding:8px 4px;
  cursor:pointer; text-align:center; color:#F4F1E8; position:relative; overflow:hidden;
  transition:border-color .15s, transform .1s; }
.slotbtn:hover{ border-color:#5C8479; }
.slotbtn:active{ transform:scale(.97); }
.slotbtn:focus-visible{ outline:2px solid #F4F1E8; outline-offset:2px; }
.slotbtn.done{ opacity:.32; cursor:default; }
.slotbtn.static{ cursor:default; }
.slotbtn.static:hover{ border-color:#47665D; }
.linkbtn{ background:none; border:none; color:#859993; cursor:pointer; padding:2px 4px;
  font-family:'Barlow Condensed',sans-serif; font-weight:600; text-transform:uppercase;
  letter-spacing:.14em; font-size:12px; }
.linkbtn:hover{ color:#F4F1E8; }
.linkbtn:focus-visible{ outline:2px solid #F4F1E8; outline-offset:2px; }
.actual{ width:52px; margin-top:3px; background:#fff; border:1px solid #C3BBA8; border-radius:2px;
  padding:3px 5px; font-family:'IBM Plex Mono',monospace; font-size:13px; color:#26332F;
  text-align:right; }
.actual::placeholder{ color:#A9A091; font-size:11px; letter-spacing:.06em; }
.actual:focus{ outline:2px solid #C8342B; outline-offset:1px; }
.slotbtn .lk{ position:absolute; left:0; top:0; bottom:0; width:3px; }
.slotname{ font-family:'Barlow Condensed',sans-serif; font-weight:800; font-size:16px;
  text-transform:uppercase; letter-spacing:.03em; }
.slotera{ font-size:10px; letter-spacing:.1em; text-transform:uppercase; margin-top:2px; }
.magnet{ background:#F4F1E8; color:#26332F; border-radius:2px; padding:10px 12px;
  display:flex; align-items:center; gap:10px; margin-bottom:6px; position:relative; }
.magnet .bar{ position:absolute; left:0; top:0; bottom:0; width:5px; }
.pickcard{ background:#F4F1E8; color:#26332F; border-radius:3px; padding:14px 14px 12px 18px;
  position:relative; box-shadow:0 6px 0 rgba(0,0,0,.28); }
.pickcard .bar{ position:absolute; left:0; top:0; bottom:0; width:6px; }
.alt{ display:flex; align-items:center; gap:10px; padding:9px 10px; border-bottom:1px solid #47665D;
  cursor:pointer; }
.alt:hover{ background:#3B544D; }
.sel{ width:100%; background:#26332F; color:#F4F1E8; border:1px solid #47665D; border-radius:3px;
  padding:10px; font-family:'IBM Plex Sans',sans-serif; font-size:16px; }
.btn{ font-family:'Barlow Condensed',sans-serif; font-weight:800; text-transform:uppercase;
  letter-spacing:.08em; font-size:16px; background:#C8342B; color:#fff; border:none;
  border-radius:3px; padding:12px 18px; cursor:pointer; width:100%; }
.btn:active{ transform:translateY(1px); }
.btn.ghost{ background:transparent; color:#859993; border:1px solid #47665D; }
.tag{ font-size:10px; letter-spacing:.12em; text-transform:uppercase; padding:2px 5px;
  border-radius:2px; font-weight:600; }
.rule{ height:1px; background:#47665D; margin:12px 0; }
.confgrid{ display:grid; grid-template-columns:1fr 1fr; gap:0 14px; }
.confcol{ min-width:0; }
.teamgrid{ display:grid; grid-template-columns:repeat(2,1fr); gap:6px; }
.teambadge{ border:2px solid transparent; border-radius:4px; padding:8px 4px; cursor:pointer;
  text-align:center; line-height:1.1; transition:transform .1s, border-color .15s; }
.teambadge:hover{ border-color:#F4F1E8; }
.teambadge:active{ transform:scale(.96); }
.teambadge:focus-visible{ outline:2px solid #F4F1E8; outline-offset:2px; }
.teambadge.active{ border-color:#C8342B; }
.teambadge:disabled{ opacity:.28; cursor:not-allowed; }
.teambadge:disabled:hover{ border-color:transparent; }
.pickerbtn{ width:100%; background:#26332F; color:#F4F1E8; border:1px solid #47665D; border-radius:3px;
  padding:10px; font-family:'IBM Plex Sans',sans-serif; font-size:16px; text-align:left;
  cursor:pointer; display:flex; align-items:center; justify-content:space-between; gap:8px; }
.pickerbtn:hover{ border-color:#5C8479; }
.pickerbtn:focus-visible{ outline:2px solid #F4F1E8; outline-offset:2px; }
.pickerbtn .chev{ color:#859993; font-size:12px; }
.pickerbtn .swatch{ width:14px; height:14px; border-radius:2px; flex-shrink:0; }
.pickerbtn .placeholder{ color:#859993; }
.modalback{ position:fixed; inset:0; background:rgba(16,24,22,.72); z-index:50;
  display:flex; align-items:flex-end; justify-content:center; }
.modal{ background:#26332F; width:100%; max-width:520px; max-height:88vh; overflow-y:auto;
  border-radius:10px 10px 0 0; padding:16px 14px calc(16px + env(safe-area-inset-bottom)); }
.modalhead{ display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;
  position:sticky; top:-16px; background:#26332F; padding-top:2px; }
.modalclose{ background:#30453F; border:1px solid #47665D; color:#F4F1E8; border-radius:50%;
  width:30px; height:30px; font-size:17px; line-height:1; cursor:pointer; }
.modalclose:hover{ border-color:#5C8479; }
.exportbox{ width:100%; height:240px; background:#1B2620; color:#F4F1E8; border:1px solid #47665D;
  border-radius:3px; padding:10px; font-family:'IBM Plex Mono',monospace; font-size:12px;
  line-height:1.5; resize:vertical; }
.exportbox:focus{ outline:2px solid #5C8479; outline-offset:1px; }
@media (min-width:600px){ .modalback{ align-items:center; } .modal{ border-radius:10px; } }
@media (max-width:380px){ .slotgrid{ grid-template-columns:repeat(2,1fr); } }
@media (prefers-reduced-motion:reduce){ .slotbtn{ transition:none; } }
`;

  /* ---------------- setup ---------------- */
  if (!started) {
    return (
      <div className="wr">
        <style>{css}</style>
        <div className="eyebrow">Quick Play</div>
        <img src={logo} alt="War Room" style={{ height: 84, display: "block", margin: "14px 0 28px" }} />
        <div className="panel">
          <div className="eyebrow" style={{ marginBottom: 8 }}>Round 1 · your franchise</div>
          <button type="button" className="pickerbtn" onClick={() => setPickerOpen(true)}>
            {franchise ? (
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span className="swatch" style={{ background: TEAMS[franchise].color }} />
                {TEAMS[franchise].name}
              </span>
            ) : (
              <span className="placeholder">Choose the team you're playing as</span>
            )}
            <span className="chev">▾</span>
          </button>

          {pickerOpen && (
            <TeamPicker
              title="Choose your franchise"
              selected={franchise}
              onPick={t => { setFranchise(t); setPickerOpen(false); }}
              onClose={() => setPickerOpen(false)}
            />
          )}

          <div className="rule" />
          <div className="eyebrow" style={{ marginBottom: 2 }}>Era locks · fixed for the board</div>
          <div style={{ fontSize: 13, color: "#859993", marginBottom: 10 }}>
            Which slot did each era land on?
          </div>
          {ERA_KEYS.map(k => (
            <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <div style={{ width: 5, height: 38, background: ERAS[k].color, flexShrink: 0 }} />
              <div style={{ width: 84, flexShrink: 0 }}>
                <div className="slotname" style={{ fontSize: 15 }}>{ERAS[k].label}</div>
                <div className="mono" style={{ fontSize: 11, color: "#859993" }}>{ERAS[k].sub}</div>
              </div>
              <select className="sel" style={{ flex: 1, padding: 8 }}
                value={eraSlots[k] || ""} onChange={e => setEraSlot(k, e.target.value)}>
                <option value="">—</option>
                {SLOTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
          ))}

          <div style={{ height: 6 }} />
          <button className="btn" disabled={!franchise || !locksValid}
            style={{ opacity: franchise && locksValid ? 1 : .4 }}
            onClick={() => { setCurrentTeam(franchise); setStarted(true); }}>
            Open the board
          </button>
          {franchise && !locksValid && (
            <div className="mono" style={{ fontSize: 12, color: "#C8912F", marginTop: 8 }}>
              Set all three eras on three different slots.
            </div>
          )}
        </div>
        <p className="mono" style={{ fontSize: 12, color: "#859993", lineHeight: 1.6 }}>
          Ratings are estimates modeled on era-adjusted Approximate Value, not the game's
          real numbers. Log your actual results and they can be corrected.
        </p>
      </div>
    );
  }

  /* ---------------- main ---------------- */
  return (
    <div className="wr">
      <style>{css}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <div className="eyebrow">{TEAMS[franchise].name}</div>
          <img src={logo} alt="War Room" style={{ height: 40, display: "block", margin: "4px 0 0" }} />
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="eyebrow">Round</div>
          <div className="disp mono" style={{ fontSize: 32 }}>{Math.min(round, 8)}<span style={{ color: "#859993", fontSize: 19 }}>/8</span></div>
        </div>
      </div>

      <div className="rule" />

      {/* on the clock */}
      {openSlots.length > 0 && (
        <div className="panel" style={{ borderColor: currentTeam ? "#C8342B" : "#47665D" }}>
          <div className="eyebrow" style={{ color: "#C8342B", marginBottom: 8 }}>On the clock</div>
          {round === 1 ? (
            <div className="disp" style={{ fontSize: 28, marginBottom: 10 }}>{TEAMS[franchise].name}</div>
          ) : (
            <>
              <button type="button" className="pickerbtn" onClick={() => setDealtPickerOpen(true)}>
                {currentTeam ? (
                  <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span className="swatch" style={{ background: TEAMS[currentTeam].color }} />
                    {TEAMS[currentTeam].name}
                  </span>
                ) : (
                  <span className="placeholder">Which team were you dealt?</span>
                )}
                <span className="chev">▾</span>
              </button>
              {dealtPickerOpen && (
                <TeamPicker
                  title="Which team were you dealt?"
                  exclude={usedTeams}
                  selected={currentTeam}
                  onPick={t => { setCurrentTeam(t); setDealtPickerOpen(false); }}
                  onClose={() => setDealtPickerOpen(false)}
                />
              )}
            </>
          )}

          <div style={{ height: 12 }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="eyebrow">Era locks</div>
            <button className="linkbtn" onClick={() => setEditingLocks(v => !v)}>
              {editingLocks ? "done" : "fix"}
            </button>
          </div>
          <div style={{ height: 6 }} />

          {editingLocks ? (
            ERA_KEYS.map(k => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                <div style={{ width: 4, height: 32, background: ERAS[k].color, flexShrink: 0 }} />
                <div className="slotname" style={{ fontSize: 14, width: 62, flexShrink: 0 }}>{ERAS[k].label}</div>
                <select className="sel" style={{ flex: 1, padding: 7 }}
                  value={eraSlots[k] || ""} onChange={e => setEraSlot(k, e.target.value)}>
                  <option value="">—</option>
                  {SLOTS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </div>
            ))
          ) : (
            <div className="slotgrid">
              {SLOTS.map(s => {
                const filled = !!board[s.id];
                const lock = locks[s.id];
                const o = outlook[s.id];
                const scarce = !filled && lock && o.count <= 4;
                return (
                  <div key={s.id} className={"slotbtn static" + (filled ? " done" : "")}>
                    {lock && <span className="lk" style={{ background: ERAS[lock].color }} />}
                    <div className="slotname">{s.label}</div>
                    <div className="slotera" style={{ color: lock ? ERAS[lock].color : "#5C8479" }}>
                      {lock ? ERAS[lock].sub : "any era"}
                    </div>
                    {scarce && (
                      <div className="mono" style={{ fontSize: 10, color: "#C8342B", marginTop: 2 }}>
                        {o.count} left
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* log any player, drafted or not */}
      {currentTeam && (
        <div className="panel">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <div className="eyebrow">Log a rating</div>
            <button className="linkbtn" onClick={() => setShowAdd(v => !v)}>
              {showAdd ? "close" : "open"}
            </button>
          </div>
          {showAdd && (
            <>
              <div style={{ fontSize: 13, color: "#859993", margin: "6px 0 10px", lineHeight: 1.5 }}>
                Anyone the game showed you for {TEAMS[currentTeam].name} — scouted names count too.
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                <select className="sel" style={{ width: 96, padding: 8 }}
                  value={draftForm.pool} onChange={e => setDraftForm(f => ({ ...f, pool: e.target.value }))}>
                  {["QB", "RB", "WR", "TE", "F7", "DB"].map(p => <option key={p} value={p}>{p}</option>)}
                </select>
                <input className="sel" style={{ flex: 1, padding: 8 }} placeholder="Player name"
                  value={draftForm.name} onChange={e => setDraftForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <input className="sel" style={{ flex: 1, padding: 8 }} placeholder="From" inputMode="numeric"
                  value={draftForm.start} onChange={e => setDraftForm(f => ({ ...f, start: e.target.value }))} />
                <input className="sel" style={{ flex: 1, padding: 8 }} placeholder="To" inputMode="numeric"
                  value={draftForm.end} onChange={e => setDraftForm(f => ({ ...f, end: e.target.value }))} />
                <input className="sel" style={{ width: 84, padding: 8 }} placeholder="Rating" inputMode="decimal"
                  value={draftForm.rating || ""} onChange={e => setDraftForm(f => ({ ...f, rating: e.target.value }))} />
              </div>
              <div style={{ height: 8 }} />
              <button className="btn" disabled={!draftForm.name || !draftForm.rating}
                style={{ opacity: draftForm.name && draftForm.rating ? 1 : .4 }}
                onClick={() => {
                  const name = draftForm.name.trim();
                  const rating = Number(draftForm.rating);
                  const start = Number(draftForm.start) || 1960;
                  const end = Number(draftForm.end) || start;
                  const inDb = (TEAMS[currentTeam].p[draftForm.pool] || []).some(r => r[0] === name);
                  if (!inDb) {
                    const nx = [...extras.filter(x => !(x.team === currentTeam && x.name === name)),
                      { team: currentTeam, pool: draftForm.pool, name, start, end, rating }];
                    setExtras(nx); persist("wr:extras", nx);
                  }
                  const na = { ...actuals, [pkey(currentTeam, name)]: rating };
                  setActuals(na); persist("wr:actuals", na);
                  setDraftForm({ pool: draftForm.pool, name: "", start: "", end: "", rating: "" });
                }}>
                Save rating
              </button>
            </>
          )}
        </div>
      )}

      {/* recommendation */}
      {currentTeam && openSlots.length > 0 && (
        top ? (
          <>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Take this</div>
            <div className="pickcard">
              <span className="bar" style={{ background: TEAMS[currentTeam].color }} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div className="disp" style={{ fontSize: 29 }}>{top.player.name}</div>
                  <div className="mono" style={{ fontSize: 13, color: "#859993", marginTop: 3 }}>
                    {TEAMS[currentTeam].name} · {top.player.start}–{top.player.end}
                  </div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                  <div className="disp" style={{ fontSize: 37, lineHeight: 1 }}>{top.player.rating}</div>
                  <div className="eyebrow" style={{ color: top.player.known ? "#3EAD88" : "#B7A482" }}>
                    {top.player.known ? "confirmed" : "est."}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
                <span className="tag" style={{ background: "#26332F", color: "#F4F1E8" }}>
                  slot · {top.slot.label}
                </span>
                {top.era && (
                  <span className="tag" style={{ background: ERAS[top.era].color, color: "#26332F" }}>
                    {ERAS[top.era].label}
                  </span>
                )}
                <span className="tag" style={{ background: "#DCD3C0", color: "#26332F" }}>
                  {top.raw >= 0 ? "+" : ""}{top.raw.toFixed(1)} vs. a later team
                </span>
                {top.risk > 6 && (
                  <span className="tag" style={{ background: "#C8342B", color: "#fff" }}>
                    running out · {outlook[top.slot.id].count} teams left
                  </span>
                )}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.5, color: "#26332F", margin: "10px 0 12px" }}>
                {top.risk > 6
                  ? (top.era
                      ? `${top.slot.label} is locked to ${ERAS[top.era].label} and only ${outlook[top.slot.id].count} of the ${remainingTeams.length} teams left can fill it. Take it now or risk being stuck.`
                      : `Only ${outlook[top.slot.id].count} of the ${remainingTeams.length} teams left have anyone at ${top.slot.label}. Fill it while you can.`)
                  : top.raw > 8
                  ? `${TEAMS[currentTeam].name} are far stronger at ${top.slot.label} than the average team still in the pool. Spend them here.`
                  : top.raw > 0
                  ? `A modest edge at ${top.slot.label}. Nothing else on this roster beats what a later team should hand you.`
                  : `No real edge anywhere — this is the least costly slot to burn ${TEAMS[currentTeam].name} on.`}
              </p>
              <button className="btn" onClick={() => draft(top)}>
                Draft to {top.slot.label}
              </button>
            </div>

            <div style={{ height: 14 }} />
            <div className="eyebrow" style={{ marginBottom: 4 }}>Best at every other slot</div>
            <div className="panel" style={{ padding: "2px 0" }}>
              {bestBySlot.slice(1).map(o => (
                <div key={o.slot.id} className="alt" onClick={() => draft(o)}>
                  <div style={{ width: 4, height: 30, background: o.era ? ERAS[o.era].color : "#5C8479", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="disp" style={{ fontSize: 18 }}>{o.player.name}</div>
                    <div className="mono" style={{ fontSize: 12, color: "#859993" }}>
                      {o.slot.label} · {o.player.start}–{o.player.end}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="mono" style={{ fontSize: 18 }}>{o.player.rating}</div>
                    <div className="mono" style={{ fontSize: 11, color: o.raw >= 0 ? "#4E9E9A" : "#BA7E74" }}>
                      {o.raw >= 0 ? "+" : ""}{o.raw.toFixed(1)}
                    </div>
                  </div>
                </div>
              ))}
              {bestBySlot.length <= 1 && (
                <div style={{ padding: 14, color: "#859993", fontSize: 14 }}>
                  Only one slot is legal for this team under the current locks.
                </div>
              )}
            </div>

            {endangered.length > 0 && (
              <div className="panel" style={{ borderColor: "#C8912F" }}>
                <div className="eyebrow" style={{ color: "#C8912F", marginBottom: 8 }}>Running dry</div>
                {endangered.map(x => (
                  <div key={x.slot.id} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 4, height: 26, flexShrink: 0,
                      background: x.era ? ERAS[x.era].color : "#5C8479" }} />
                    <div className="slotname" style={{ fontSize: 15, flex: 1 }}>
                      {x.slot.label}
                      {x.era && <span className="mono" style={{ fontSize: 11, color: "#859993", marginLeft: 6 }}>
                        {ERAS[x.era].sub}</span>}
                    </div>
                    <div className="mono" style={{ fontSize: 14, color: x.count <= 2 ? "#C8342B" : "#C8912F" }}>
                      {x.count} of {remainingTeams.length}
                    </div>
                  </div>
                ))}
                <div style={{ fontSize: 13, color: "#859993", lineHeight: 1.5, marginTop: 6 }}>
                  Teams left that can legally fill these. Grab them the moment one comes up.
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="panel">
            <div className="disp" style={{ fontSize: 19, marginBottom: 6 }}>Nothing legal here</div>
            <div style={{ fontSize: 14, color: "#859993", lineHeight: 1.5 }}>
              No player in the database fits an open slot for {TEAMS[currentTeam].name} under these locks.
              If the game is still offering someone, take them and tell me the name — they're missing here.
            </div>
          </div>
        )
      )}

      {/* board */}
      <div style={{ height: 8 }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div className="eyebrow">The board</div>
        <div className="mono" style={{ fontSize: 13, color: "#859993" }}>
          projected {projected}
        </div>
      </div>
      <div className="rule" style={{ margin: "6px 0 8px" }} />
      {SLOTS.map(s => {
        const f = board[s.id];
        if (!f) return (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10,
            padding: "9px 12px", border: "1px dashed #47665D", borderRadius: 2, marginBottom: 6 }}>
            <div className="slotname" style={{ color: "#5C8479", width: 74 }}>{s.label}</div>
            <div className="mono" style={{ fontSize: 12, color: "#859993" }}>open</div>
          </div>
        );
        return (
          <div key={s.id} className="magnet">
            <span className="bar" style={{ background: TEAMS[f.team].color }} />
            <div className="slotname" style={{ width: 68, color: "#859993", flexShrink: 0 }}>{s.label}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="disp" style={{ fontSize: 18 }}>{f.name}</div>
              <div className="mono" style={{ fontSize: 11, color: "#859993" }}>
                {TEAMS[f.team].name} · {f.years}
              </div>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div className="mono" style={{ fontSize: 16, color: "#859993" }}>{f.rating}</div>
              <input className="actual" inputMode="decimal" placeholder="real"
                aria-label={`Rating the game gave ${f.name}`}
                value={actuals[pkey(f.team, f.name)] ?? ""}
                onChange={e => {
                  const raw = e.target.value;
                  if (raw !== "" && !/^-?\d*\.?\d*$/.test(raw)) return;
                  const next = { ...actuals };
                  if (raw === "") delete next[pkey(f.team, f.name)];
                  else next[pkey(f.team, f.name)] = raw;
                  setActuals(next); persist("wr:actuals", next);
                }} />
            </div>
          </div>
        );
      })}

      <div className="panel" style={{ marginTop: 10 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
          <div className="eyebrow">Calibration</div>
          <button className="linkbtn" onClick={() => setExportOpen(true)}>export</button>
        </div>
        {calib.fitted ? (
          <>
            <div style={{ fontSize: 14, color: "#B1BEBA", lineHeight: 1.55 }}>
              Fitted on <strong style={{ color: "#F4F1E8" }}>{calib.n}</strong> real ratings.
              Estimates are being corrected by{" "}
              <span className="mono">×{calib.a.toFixed(2)} {calib.b >= 0 ? "+" : "−"} {Math.abs(calib.b).toFixed(1)}</span>.
            </div>
            <div className="mono" style={{ fontSize: 12, color: calib.r2 > 0.7 ? "#4E9E9A" : "#C8912F", marginTop: 6 }}>
              r² {calib.r2.toFixed(2)} · {calib.r2 > 0.7
                ? "my ordering tracks theirs well"
                : "ordering still diverges — more data or a rethink needed"}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 14, color: "#859993", lineHeight: 1.55 }}>
            {calib.n} of 6 ratings logged. Type the number the game shows next to each pick;
            once there are six, every other estimate gets pulled toward their scale.
            Anything you've logged is used exactly as entered.
          </div>
        )}
      </div>

      {exportOpen && (
        <div className="modalback" onClick={() => setExportOpen(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div className="modalhead">
              <div className="eyebrow">Export logged data</div>
              <button type="button" className="modalclose" onClick={() => setExportOpen(false)} aria-label="Close">✕</button>
            </div>
            <div style={{ fontSize: 13, color: "#859993", marginBottom: 10, lineHeight: 1.5 }}>
              Every real rating you've logged, plus any players missing from the database. Copy
              this and send it over so the estimates can be corrected for good.
            </div>
            <button type="button" className="btn" style={{ marginBottom: 10 }} onClick={copyExport}>
              {copyStatus === "copied" ? "Copied!" : copyStatus === "failed" ? "Couldn't copy — select below" : "Copy to clipboard"}
            </button>
            <textarea className="exportbox mono" readOnly value={exportText}
              onFocus={e => e.target.select()} />
          </div>
        </div>
      )}

      {openSlots.length === 0 && (
        <div className="panel" style={{ marginTop: 12, borderColor: "#4E9E9A" }}>
          <div className="eyebrow" style={{ color: "#4E9E9A" }}>Roster complete</div>
          <div className="disp" style={{ fontSize: 37, margin: "4px 0" }}>
            {Math.round(Object.values(board).reduce((a, b) => a + b.rating, 0) * 10) / 10}
          </div>
          <div style={{ fontSize: 14, color: "#859993" }}>
            Estimated roster strength. Tell me the score the game actually gave you and
            this scale can be recalibrated.
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <button className="btn ghost" onClick={undo} disabled={!usedTeams.length}
          style={{ opacity: usedTeams.length ? 1 : .35 }}>Undo pick</button>
        <button className="btn ghost" onClick={reset}>New board</button>
      </div>
    </div>
  );
}
