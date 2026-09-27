import {quantity} from './measurements.js';
// Original instructions for the app's ingredient formulas, not transcriptions of linked recipes.
// Water tokens are scaled alongside the ingredient list; times and temperatures are not.
const recipe = (vessels, steps, extra = {}) => ({vessels, steps: steps.map(([title, text]) => ({title, text})), ...extra});
export const COOKBOOK = {
  'crispy-gnocchi': recipe(['Rimmed baking sheet'], [
    ['Heat & chop', 'Heat the oven to 425°F / 220°C. Halve the Brussels sprouts, slice the onion and fully cooked sausage. Spread on a large rimmed sheet with the shelf-stable gnocchi.'],
    ['Roast', 'Toss everything with the oil and Italian herbs. Spread into a single layer. Roast 25–30 minutes, turning halfway, until the sprouts are tender and the gnocchi have golden edges.'],
    ['Finish', 'Sprinkle with Parmesan. Taste and season with salt and pepper. Serve promptly for the crispest edges.'],
  ]),
  'spinach-ravioli': recipe(['9 × 13-inch baking dish with foil'], [
    ['Layer', 'Heat the oven to 400°F / 200°C. Stir {water:120} into the marinara in the dish. Fold in spinach and frozen ravioli; coat every piece.'],
    ['Cover & bake', 'Scatter mozzarella and Parmesan on top. Cover tightly with foil and bake 35–40 minutes, until the ravioli are tender and the center reaches 165°F / 74°C.'],
    ['Brown the top', 'Uncover and bake 5–10 minutes until bubbling and lightly golden. Rest 5 minutes before portioning.'],
  ], {dump: true}),
  'beef-stroganoff': recipe(['4-quart pot with lid'], [
    ['Brown', 'Slice the mushrooms and mince the garlic. Melt butter in the pot over medium-high heat. Add beef and mushrooms; break the beef into small crumbles and cook 7–9 minutes, until the meat reaches 160°F / 71°C.'],
    ['Simmer', 'Stir in garlic and Italian herbs for 30 seconds. Add broth and dry egg noodles. Bring to a simmer, cover loosely and cook 8–12 minutes, stirring often, until the noodles are tender. Add a splash of water if the pot gets dry.'],
    ['Make it creamy', 'Remove from the heat and stir in sour cream. Let stand 2 minutes; loosen with water if needed. Taste and season with salt and pepper.'],
  ]),
  'shrimp-fajitas': recipe(['Rimmed baking sheet'], [
    ['Start the vegetables', 'Heat the oven to 425°F / 220°C. Slice peppers and onion thinly. Toss on the sheet with half the oil and half the garlic-cumin seasoning. Roast 12–15 minutes.'],
    ['Add shrimp', 'Pat thawed, peeled shrimp dry. Toss with the remaining oil and seasoning, then add to the vegetables. Roast 6–8 minutes until the shrimp are opaque and firm.'],
    ['Assemble', 'Warm tortillas in a foil packet at the edge of the sheet during the last 3 minutes. Squeeze lime over the filling and divide among tortillas.'],
  ]),
  'eggroll': recipe(['12-inch skillet', 'Small rice pot with lid'], [
    ['Start the rice', 'Cook the dry rice in the small pot with the water amount and timing on its package. Slice mushrooms and mince garlic and ginger while it cooks.'],
    ['Brown the turkey', 'Heat oil in the skillet over medium-high. Add turkey and mushrooms and cook 7–9 minutes, breaking up the meat, until the turkey reaches 165°F / 74°C.'],
    ['Toss & serve', 'Add garlic, ginger, cabbage and soy sauce. Stir-fry 4–6 minutes until the cabbage softens but retains some crunch. Serve over the cooked rice.'],
  ]),
  'pepper-rice': recipe(['Deep 12-inch skillet with lid'], [
    ['Brown & soften', 'Dice peppers and onion. Cook beef and onion in the skillet over medium heat for 7–9 minutes, until beef reaches 160°F / 71°C. Add peppers and Italian herbs and cook 2 minutes.'],
    ['Cook rice', 'Stir in dry long-grain white rice, tomatoes with their juices and broth. Bring to a boil, cover and reduce to low. Simmer 18–22 minutes until rice is tender. If still firm and dry, add a splash of water and cook covered 5 minutes more.'],
    ['Melt & rest', 'Scatter cheddar on top. Cover off the heat for 5 minutes, then fluff and serve.'],
  ]),
  'cheeseburger-pasta': recipe(['4-quart pot with lid'], [
    ['Brown beef', 'Dice onion and pickles separately. Cook beef and onion over medium-high heat for 7–9 minutes, breaking into crumbles, until beef reaches 160°F / 71°C.'],
    ['Cook the macaroni', 'Add broth, milk, mustard and dry short pasta. Bring just to a simmer; cook partially covered 10–14 minutes, stirring frequently so the milk does not scorch. Add splashes of water if needed until pasta is tender.'],
    ['Finish', 'Turn off the heat, stir in cheddar and rest 2 minutes. Top each portion with pickles just before eating.'],
  ]),
  'mushroom-pasta': recipe(['4-quart pot with lid'], [
    ['Brown mushrooms', 'Slice mushrooms and mince garlic. Heat oil over medium-high. Cook mushrooms 6–8 minutes until their liquid evaporates and edges brown. Add garlic for 30 seconds.'],
    ['Simmer pasta', 'Add broth, {water:150} and dry short pasta. Bring to a simmer and cook partially covered 10–14 minutes, stirring often, until tender. Add a little extra water if the pot dries out.'],
    ['Finish the sauce', 'Reduce heat to low. Stir in spinach, cream cheese and Parmesan until the spinach wilts and the sauce is smooth, about 2 minutes. Season to taste.'],
  ]),
  'lemon-shrimp-rice': recipe(['4-quart pot with lid'], [
    ['Start rice', 'Mince garlic and zest the lemon. Melt butter over medium heat. Stir garlic and dry long-grain white rice for 1 minute. Add broth, bring to a boil, cover and simmer on low 15 minutes.'],
    ['Add shrimp', 'Lay thawed, peeled shrimp and spinach over the rice. Cover and cook 5–7 minutes until shrimp are opaque and firm and rice is tender; add a splash of water if needed.'],
    ['Rest & brighten', 'Rest covered off the heat for 5 minutes. Add lemon zest and juice to taste, then gently fold everything together.'],
  ]),
  'pesto-chicken-bake': recipe(['9 × 13-inch baking dish with foil', 'Nonstick skillet'], [
    ['Cook chicken', 'Heat oven to 425°F / 220°C. Dice chicken into ½-inch pieces and zucchini into small cubes. Cook chicken in the nonstick skillet with a splash of broth, stirring 6–8 minutes, to 165°F / 74°C.'],
    ['Mix & cover', 'Combine cooked chicken, zucchini, dry short pasta, pesto, remaining broth and {water:150} in the baking dish. Press pasta into the liquid and cover tightly with foil.'],
    ['Bake & finish', 'Bake 30–40 minutes until pasta is tender, adding a splash of hot water and re-covering if needed. Top with mozzarella; bake uncovered 5–10 minutes until bubbling and the center reaches 165°F / 74°C. Rest 5 minutes.'],
  ]),
  'fish-tacos': recipe(['Air-fryer basket'], [
    ['Coat fish', 'Heat air fryer to 390°F / 200°C. Cut fish into thick strips. Mix breadcrumbs with cumin-garlic seasoning in a bowl. Brush fish with oil and press into the crumbs.'],
    ['Cook fish', 'Air-fry in a single layer for 8–12 minutes, turning carefully halfway, until fish reaches 145°F / 63°C. Cook in batches if crowded.'],
    ['Assemble', 'Mix yogurt with lime juice in a sauce bowl. Fill tortillas with cabbage, fish and sauce. Keep components separate until eating.'],
  ]),
  'slow-cube': recipe(['3–4-quart slow cooker', 'Potato pot'], [
    ['Load cooker', 'Slice onion and mushrooms and layer in the cooker with thawed cube steak. Stir mushroom soup with {water:120}, pour over and cover.'],
    ['Slow cook', 'Cook on low 6–8 hours until fork-tender and the beef reaches at least 145°F / 63°C with a 3-minute rest. Actual timing varies with the cooker.'],
    ['Make potatoes', 'About 25 minutes before serving, cube potatoes, cover with water in a pot and simmer 15–20 minutes until tender. Drain and mash with milk and butter. Serve with steak and gravy.'],
  ], {extraTools: ['Colander', 'Masher']}),
  'pesto-ravioli': recipe(['Deep 12-inch skillet with lid'], [
    ['Blister tomatoes', 'Heat oil over medium-high and cook cherry tomatoes 4–5 minutes until they begin to burst.'],
    ['Steam ravioli', 'Add frozen ravioli and {water:180}, cover and simmer over medium-low 6–10 minutes, stirring gently, until ravioli are tender and their centers reach 165°F / 74°C. Add water if needed; check package cooking directions.'],
    ['Finish', 'Uncover to evaporate excess water. Fold in spinach until wilted, then turn off heat and stir in pesto and Parmesan.'],
  ]),
  'egg-muffins': recipe(['12-cup muffin pan'], [
    ['Mix', 'Heat oven to 350°F / 175°C. Grease muffin cups with oil. Chop spinach and whisk in a bowl with eggs, milk and cheddar; season lightly.'],
    ['Bake', 'Divide among muffin cups, filling no more than three-quarters full. Bake 18–23 minutes until centers are set and reach 160°F / 71°C. Cool 5 minutes before loosening.'],
    ['Serve & pack', 'Divide muffins into the listed meal portions and serve with wheat toast. Refrigerate spare muffins separately from bread.'],
  ], {extraTools: ['Knife', 'Cutting board']}),
  'savory-cottage': recipe(['12-inch skillet'], [
    ['Sauté', 'Slice mushrooms and mince garlic. Heat oil over medium-high. Cook mushrooms 6–8 minutes until browned, adding garlic for the final minute.'],
    ['Toast', 'Toast wheat bread. Spread with cottage cheese and spoon hot mushrooms over it. Season with pepper.'],
    ['Pack separately', 'For later meals, chill mushrooms and cottage cheese separately and assemble on fresh toast.'],
  ]),
  'sweet-hash': recipe(['12-inch skillet with lid'], [
    ['Start vegetables', 'Cut sweet potatoes into small ½-inch cubes; dice pepper and onion. Heat oil over medium, add vegetables and {water:60}, cover and cook 8–10 minutes until potatoes begin to soften.'],
    ['Brown turkey', 'Uncover, push vegetables aside and add turkey with cumin-garlic seasoning. Cook 7–9 minutes, breaking up turkey, to 165°F / 74°C. Stir together.'],
    ['Add eggs', 'Make wells and crack in eggs. Cover on low heat 4–7 minutes until whites and yolks are firm and sweet potatoes are tender.'],
  ]),
  'chocolate-cottage': recipe([], [
    ['Mix', 'Stir cottage cheese, peanut butter, cocoa and honey in a bowl until evenly mixed. For a smoother texture, mash firmly with a fork.'],
    ['Serve', 'Divide into breakfast portions and top with granola just before eating.'],
    ['Store', 'Keep cottage mixture chilled; store granola separately so it stays crisp.'],
  ], {extraTools: ['Fork']}),
  'jp-turkey-rice': recipe(['Deep 12-inch skillet with lid'], [
    ['Brown', 'Cook turkey over medium-high heat 7–9 minutes, breaking it into crumbles, to 165°F / 74°C. Stir in Italian herbs, garlic powder and onion powder.'],
    ['Add vegetables', 'Add frozen carrots, drained corn and tomatoes with their juices. Cover and simmer 5–7 minutes until carrots are tender.'],
    ['Add cooked rice', 'Break up the ready-to-heat rice and fold it in. Cover and cook 3–5 minutes, stirring once, until hot throughout. Use cooked pouch rice, not dry rice.'],
  ]),
  'fh-broccoli-alfredo': recipe(['Deep 12-inch skillet with lid'], [
    ['Cook chicken', 'Dice chicken into small pieces. Heat oil over medium and cook chicken 6–8 minutes to 165°F / 74°C. Stir in flour, garlic powder, onion powder and Italian herbs for 1 minute.'],
    ['Simmer pasta', 'Slowly stir in broth and milk, then dry short pasta. Bring to a gentle simmer and cover partially. Cook 10 minutes, stirring frequently to keep milk from scorching.'],
    ['Add broccoli', 'Stir in frozen broccoli and cook 5–8 minutes more until broccoli and pasta are tender. Add a splash of water if thick. Turn off heat and stir in Parmesan.'],
  ]),
  'jp-beef-tacos': recipe(['12-inch skillet'], [
    ['Brown beef', 'Cook beef over medium-high 7–9 minutes to 160°F / 71°C. Stir in tomato paste, cumin, sweet paprika, garlic powder and Italian herbs for 1 minute.'],
    ['Simmer', 'Stir in drained pinto beans and {water:80}. Simmer 3–5 minutes until thick. Chop lettuce and tomatoes and grate cheddar.'],
    ['Build tacos', 'Brush tortillas lightly with oil and warm on a microwave-safe plate, covered with a damp paper towel, in 20-second bursts. Fill with beef, vegetables and cheddar just before eating.'],
  ]),
  'jp-chicken-veggie-rice': recipe(['Deep 12-inch skillet with lid'], [
    ['Soften onion', 'Dice onion. Heat oil over medium and cook onion 4–5 minutes until softened.'],
    ['Steam', 'Add broth, frozen broccoli, drained corn and Italian herbs. Bring to a simmer, cover and cook 4 minutes. Stir in chopped cooked chicken and dry instant rice.'],
    ['Finish', 'Cover and cook according to the instant-rice package, usually 5 minutes, then rest off heat 5 minutes. Check rice is tender and chicken reaches 165°F / 74°C. Add water if needed. Do not substitute regular dry rice.'],
  ]),
  'jp-ham-fried-rice': recipe(['Large nonstick skillet'], [
    ['Scramble eggs', 'Dice carrots and ham; slice green onions. Melt butter over medium. Beat eggs in a bowl, scramble until fully set and transfer to a plate.'],
    ['Fry rice', 'Heat sesame oil in the same skillet. Stir-fry carrots and ham 4–5 minutes. Add corn and cooked pouch rice, breaking up clumps; cook 3–4 minutes.'],
    ['Season', 'Add broth, soy sauce, cooked eggs and green onions. Stir-fry until everything is hot throughout.'],
  ]),
  'jp-tomato-orzo': recipe(['4-quart pot with lid'], [
    ['Brown chicken', 'Dice chicken and onion and mince garlic. Heat oil and butter over medium-high. Cook chicken and onion 7–9 minutes to 165°F / 74°C. Add garlic and all dried seasonings for 30 seconds.'],
    ['Cook orzo', 'Stir in dry orzo, tomato sauce and broth. Cover partially and simmer gently 10–14 minutes, stirring often, until tender. Add water if the sauce gets too thick before orzo softens.'],
    ['Finish', 'Add cream and spinach and cook 2 minutes. Remove from heat, stir in Parmesan and serve.'],
  ]),
  'jp-sausage-vegetable-tray': recipe(['Large rimmed baking sheet'], [
    ['Prepare', 'Heat oven to 425°F / 220°C. Cut carrots into thin coins, halve sprouts and cut onion into wedges. Toss on the sheet with oil, Italian herbs and garlic powder.'],
    ['Roast', 'Nestle raw sweet Italian sausage links among vegetables. Roast 25–35 minutes, turning everything halfway, until vegetables are tender and sausage reaches 160°F / 71°C, or 165°F / 74°C if made with poultry.'],
    ['Serve', 'Rest links briefly, then slice and divide with vegetables into meal portions.'],
  ]),
  'jp-chicken-stir-fry': recipe(['Deep 12-inch skillet with lid'], [
    ['Prep sauce & vegetables', 'Mix cornstarch, broth, soy sauce and honey in a bowl. Dice chicken; cut broccoli small, thinly slice carrots and pepper, and mince garlic and ginger.'],
    ['Stir-fry', 'Heat oil over medium-high. Cook chicken 6–8 minutes to 165°F / 74°C. Add vegetables and {water:45}, cover 3 minutes, then uncover and stir-fry 3–4 minutes.'],
    ['Glaze & serve', 'Add garlic and ginger for 30 seconds. Stir sauce again and pour in; simmer 1–2 minutes until glossy. Heat pouch rice according to its package and serve with the stir-fry.'],
  ]),
  'jp-pizza-sliders': recipe(['9 × 13-inch baking dish with foil'], [
    ['Assemble', 'Heat oven to 350°F / 175°C. Split slider rolls horizontally and set bottoms in the dish. Spread with marinara, then layer pepperoni and mozzarella. Add the roll tops.'],
    ['Brush', 'Melt butter in a small microwave-safe bowl. Stir in Italian herbs and Parmesan and brush over rolls.'],
    ['Bake', 'Cover loosely with foil and bake 15 minutes. Uncover and bake another 8–10 minutes until filling is hot and cheese has melted. Cut into sliders and divide into the listed meal portions.'],
  ]),
  'jp-beef-greens-skillet': recipe(['Deep 12-inch skillet with lid'], [
    ['Brown', 'Dice onion, peppers and zucchini. Cook beef and onion over medium-high for 7–9 minutes to 160°F / 71°C.'],
    ['Simmer vegetables', 'Add peppers, zucchini, tomatoes with juices, cumin, paprika, garlic powder and Italian herbs. Cover and simmer 8–10 minutes until vegetables are tender.'],
    ['Finish', 'Stir in spinach to wilt, scatter cheddar over the top and cover off heat 2 minutes to melt.'],
  ]),
  'jp-sausage-shells': recipe(['4-quart pot with lid'], [
    ['Brown sausage', 'Cook raw sweet Italian ground sausage over medium-high 7–9 minutes, crumbling it, until it reaches 160°F / 71°C, or 165°F / 74°C for poultry sausage.'],
    ['Simmer pasta', 'Add marinara, Italian herbs, dry pasta shells and {water:600}. Bring to a simmer and cook partially covered 12–16 minutes, stirring often, until pasta is tender.'],
    ['Adjust sauce', 'If pasta is still firm, add a splash of water and simmer a little longer. Rest 3 minutes before serving so sauce thickens.'],
  ]),
  'jp-skillet-lasagna': recipe(['Deep 5-quart sauté pan with lid'], [
    ['Brown sausage', 'Cook raw sweet Italian ground sausage over medium-high 7–9 minutes to 160°F / 71°C, or 165°F / 74°C for poultry sausage. Stir in onion powder, garlic powder and Italian herbs.'],
    ['Cook noodles', 'Add marinara, broth and tomatoes with their juices. Break dry lasagna sheets into bite-size pieces and press into sauce. Cover partially and simmer 18–25 minutes, stirring frequently and adding water as needed, until noodles are tender.'],
    ['Add cheese', 'Dollop cottage cheese over the top, scatter Parmesan and mozzarella, then cover on low 2–3 minutes to melt. Rest 5 minutes.'],
  ]),
  'jp-slow-beef-pasta': recipe(['4–6-quart slow cooker', '12-inch skillet', 'Pasta pot'], [
    ['Brown first', 'Cook beef in the skillet over medium-high 7–9 minutes to 160°F / 71°C. Dice pepper. Transfer beef and pepper to the slow cooker.'],
    ['Slow cook sauce', 'Add drained corn, crushed tomatoes, diced tomatoes and all dried seasonings. Cover and cook on low 4–6 hours until peppers are soft and sauce is hot.'],
    ['Cook pasta separately', 'Near serving time, boil pasta according to package directions and drain. Fold into the sauce and serve. Keep spare pasta separate to avoid very soft leftovers.'],
  ], {extraTools: ['Colander']}),
  'jp-broccoli-orzo': recipe(['4-quart pot with lid'], [
    ['Soften vegetables', 'Dice onion and carrots small. Heat oil over medium and cook 5–6 minutes. Stir in dry orzo and all dried seasonings for 1 minute.'],
    ['Simmer', 'Add broth and {water:100}, cover partially and simmer 6 minutes, stirring often. Add frozen broccoli and chopped cooked chicken; simmer 5–7 minutes more until orzo is tender and chicken reaches 165°F / 74°C.'],
    ['Finish', 'Stir in cream to warm through, then remove from heat and stir in Parmesan. Add a little water if too thick.'],
  ]),
  'jp-garlic-fish-tray': recipe(['Large rimmed baking sheet'], [
    ['Start firm vegetables', 'Heat oven to 425°F / 220°C. Thinly slice carrots, cut broccoli into small florets, slice zucchini and squash and trim asparagus. Toss carrots and broccoli on the sheet with half the oil. Roast 12 minutes.'],
    ['Add the rest', 'Add zucchini, squash, asparagus and fish. Drizzle with remaining oil, minced garlic, Italian herbs, paprika and half the lemon juice. Spread into one layer; use a second sheet if crowded.'],
    ['Roast', 'Cook 10–15 minutes until vegetables are tender and fish reaches 145°F / 63°C. Finish with remaining lemon juice.'],
  ]),
  'jp-slow-chicken-spaghetti': recipe(['3–4-quart slow cooker', 'Pasta pot'], [
    ['Load', 'Stir both condensed soups, tomatoes with juices and Italian herbs in the cooker. Add thawed chicken cut into small pieces and dot with cream cheese.'],
    ['Cook', 'Cover and cook on low 3–4 hours, until chicken reaches 165°F / 74°C. Stir well to blend cream cheese into the sauce. Timing varies with the cooker.'],
    ['Finish pasta', 'Boil pasta separately according to package timing, drain and fold into sauce with mozzarella and cheddar. Cover 5 minutes to melt.'],
  ], {extraTools: ['Colander']}),
  'jp-chicken-stroganoff': recipe(['5-quart pot with lid'], [
    ['Brown', 'Slice mushrooms and onion, mince garlic and dice chicken small. Heat oil over medium-high. Cook chicken, mushrooms and onion 8–10 minutes to 165°F / 74°C. Add garlic and dried seasonings for 30 seconds.'],
    ['Cook noodles', 'Add broth, Worcestershire and dry noodles. Simmer partially covered 8–12 minutes until noodles are tender. Mix cornstarch with {water:30} in a small bowl and stir into the simmering pot for 1–2 minutes.'],
    ['Finish', 'Remove from heat and stir in sour cream. Rest 3 minutes and season to taste.'],
  ], {extraTools: ['Slurry bowl']}),
  'jp-slow-ziti': recipe(['4–6-quart slow cooker', '12-inch skillet'], [
    ['Brown sausage', 'Dice onion and mince garlic. Cook onion and raw sweet Italian sausage in the skillet over medium-high 7–9 minutes to 160°F / 71°C, or 165°F / 74°C for poultry sausage. Stir in garlic for 30 seconds.'],
    ['Slow cook sauce', 'Transfer to cooker with tomatoes, marinara and Italian herbs. Cover and cook on low 3–4 hours.'],
    ['Add pasta late', 'Stir in dry short pasta and {water:250}. Press pasta below sauce, cover and cook on high 30–50 minutes, stirring once and checking at 30 minutes. Add hot water if dry. When pasta is tender, scatter mozzarella and cover 5 minutes to melt.'],
  ]),
  'jp-slow-spinach-orzo': recipe(['3–4-quart slow cooker'], [
    ['Load cooker', 'Dice onion and thawed chicken small, mince garlic and chop drained sun-dried tomatoes. Add these to the cooker with Italian herbs and broth. Cover and cook on low 3–4 hours until chicken reaches 165°F / 74°C.'],
    ['Add orzo', 'Stir in cream, dry orzo and {water:180}. Cover and cook on high 25–40 minutes, stirring halfway, until orzo is tender. Add hot water if it is drying out.'],
    ['Finish', 'Stir in spinach until wilted, then Parmesan. Serve promptly; orzo softens if kept on warm for a long time.'],
  ]),
  'jp-steak-quesadillas': recipe(['12-inch skillet', 'Rimmed baking sheet'], [
    ['Cook filling', 'Heat oven to 425°F / 220°C. Slice onion and peppers. Heat half the oil in the skillet over medium-high and cook vegetables 6–8 minutes. Add shaved steak and all dried seasonings; stir-fry 3–5 minutes, or longer as needed, until beef reaches 160°F / 71°C for fully cooked meat, then rest 3 minutes.'],
    ['Fill', 'Lightly brush tortillas with remaining oil. Divide beef mixture and cheddar over half of each tortilla and fold closed on the baking sheet.'],
    ['Crisp', 'Bake 8–12 minutes, turning halfway, until crisp and cheese has melted. Serve immediately.'],
  ]),
  'jp-bacon-alfredo': recipe(['Pasta pot', 'Large deep skillet'], [
    ['Cook pasta & bacon', 'Boil pasta to package timing and drain. Meanwhile chop bacon and cook in the skillet over medium heat 7–10 minutes until crisp. Spoon off excess rendered fat, leaving a thin coating.'],
    ['Make sauce', 'Set crisp bacon aside on a plate. Add minced garlic and Italian herbs to the skillet for 30 seconds. Whisk milk and cornstarch in a small bowl, then add to the skillet with cream, broth and finely chopped cooked chicken. Simmer gently 5–7 minutes, stirring, until thickened and chicken reaches 165°F / 74°C.'],
    ['Toss', 'Stir in spinach until wilted. Remove from heat, stir in Parmesan and pasta and toss until coated. Rest 2 minutes to thicken, then add bacon at serving. Keep spare bacon separate.'],
  ], {extraTools: ['Colander','Small bowl','Whisk']}),
  'jp-loaded-quesadilla': recipe(['12-inch skillet', 'Rimmed baking sheet'], [
    ['Cook filling', 'Heat oven to 425°F / 220°C. Dice onion and cook with beef in the skillet 7–9 minutes over medium-high to 160°F / 71°C. Stir in drained beans, corn, tomatoes and all dried seasonings; cook 3 minutes until excess liquid evaporates.'],
    ['Assemble', 'Brush tortillas lightly with oil. Divide filling and cheddar over half of each tortilla, fold over and arrange on the baking sheet. Work in batches if necessary.'],
    ['Bake crisp', 'Bake 10–14 minutes, turning halfway, until golden and melted. Serve immediately; keep spare filling separate from tortillas.'],
  ]),
  'jp-crispy-chicken-bowls': recipe(['Potato pot', 'Rimmed baking sheet', 'Microwave-safe bowl'], [
    ['Cook potatoes & chicken', 'Heat oven to the popcorn-chicken package temperature. Cube potatoes, put in a pot with peeled garlic, cover with water and simmer 15–20 minutes until tender. Bake fully cooked frozen popcorn-chicken bites on the sheet to package timing and 165°F / 74°C. Cut any larger pieces into small bites after heating.'],
    ['Mash', 'Drain potatoes and garlic. Mash with milk, butter and paprika. Add a splash of hot water if needed.'],
    ['Assemble', 'Heat corn and prepared gravy together in the microwave-safe bowl, stirring between 1-minute bursts until hot. Divide potatoes into bowls; add corn gravy, crispy chicken and cheddar just before eating.'],
  ], {extraTools: ['Colander', 'Masher']}),
  'jp-tomato-tortellini': recipe(['5-quart pot with lid'], [
    ['Brown chicken', 'Dice chicken, mince garlic and chop drained sun-dried tomatoes. Heat oil over medium-high and cook chicken 6–8 minutes to 165°F / 74°C. Add garlic, Italian herbs and garlic powder for 30 seconds.'],
    ['Simmer tortellini', 'Add tomatoes with juices, sun-dried tomatoes, broth, cream and frozen tortellini. Cover and simmer gently 8–12 minutes, stirring, until pasta is tender and filling reaches 165°F / 74°C. Add water if needed.'],
    ['Finish sauce', 'Mix cornstarch with {water:30} in a bowl; stir into simmering sauce for 1 minute. Add spinach to wilt, then turn off heat and stir in mozzarella and Parmesan.'],
  ]),
  'jp-italian-chicken-rice': recipe(['4-quart pot with lid'], [
    ['Brown', 'Dice chicken and onion and mince garlic. Heat oil and butter over medium-high. Cook chicken and onion 7–9 minutes to 165°F / 74°C. Stir in garlic, paprika and Italian herbs for 30 seconds.'],
    ['Simmer rice', 'Add broth and dry long-grain white rice. Bring to a boil, cover and simmer on low 18–22 minutes until rice is tender. If firm and dry, add a splash of water and cover 5 minutes more.'],
    ['Finish', 'Stir in cream and Parmesan over low heat. Rest covered off heat 5 minutes before serving.'],
  ]),
  'jp-pierogi-bake': recipe(['9 × 13-inch baking dish with foil'], [
    ['Layer', 'Heat oven to 375°F / 190°C. Spread half the marinara in the dish. Arrange frozen pierogi on top and cover with remaining marinara and Alfredo sauce. Sprinkle with Parmesan.'],
    ['Bake covered', 'Cover tightly with foil and bake 40–50 minutes until the pierogi are tender and centers reach 165°F / 74°C.'],
    ['Finish', 'Uncover and bake 10 minutes more until bubbling. Rest 5 minutes before serving.'],
  ], {dump: true}),
  'jp-chicken-corn-bake': recipe(['9 × 13-inch baking dish with foil'], [
    ['Mix in the dish', 'Heat oven to 375°F / 190°C. Grease dish with oil. Stir together chopped cooked chicken, dry instant rice, tomatoes with juices, milk, drained corn and beans, condensed chicken soup and all dried seasonings. Stir in half the cheddar.'],
    ['Bake', 'Cover tightly with foil and bake 30–40 minutes until rice is tender and the center reaches 165°F / 74°C. If rice is firm and mixture is dry, stir in a splash of hot water, cover and cook longer.'],
    ['Melt', 'Top with remaining cheddar and bake uncovered 5–10 minutes. Rest 5 minutes. Use instant rice; regular rice needs different liquid and timing.'],
  ], {dump: true}),
  'jp-sheet-pan-burgers': recipe(['Large rimmed baking sheet'], [
    ['Start potatoes', 'Heat oven to 425°F / 220°C. Cut potatoes into ½-inch cubes and onion into wedges. Toss on the sheet with oil and roast 15 minutes.'],
    ['Make burgers', 'In a bowl mix beef, breadcrumbs, mustard and Worcestershire. Shape into 4 patties per standard batch. Add to the sheet and roast 12–18 minutes until centers reach 160°F / 71°C and potatoes are tender.'],
    ['Build', 'Top patties with cheddar and return to oven 1 minute. Serve on wheat buns with lettuce, sliced tomato, pickles and the roasted onion potatoes.'],
  ]),
  'jp-italian-beef-vegetables': recipe(['Deep 12-inch skillet with lid'], [
    ['Brown beef', 'Dice onion and zucchini, thinly slice carrots, cut broccoli into small florets and mince garlic. Cook beef and onion over medium-high 7–9 minutes to 160°F / 71°C.'],
    ['Steam vegetables', 'Stir in garlic, Italian herbs and tomato paste for 1 minute. Add carrots, broccoli, zucchini and broth. Cover and cook 6–8 minutes, stirring once, until vegetables are tender.'],
    ['Serve with rice', 'Heat cooked pouch rice to package instructions and spoon beef and vegetables over it. Or fold rice into the skillet and heat through.'],
  ]),
  'jp-creamy-pepper-pasta': recipe(['Pasta pot', '12-inch skillet'], [
    ['Cook pasta', 'Boil bow-tie pasta to package timing. Reserve a small cup of pasta water, then drain. Slice onion and pepper thinly.'],
    ['Make sauce', 'Heat oil over medium in the skillet and cook onion and pepper 7–9 minutes until soft. Add onion powder, garlic powder, paprika and tomatoes with juices. Simmer 3 minutes, then add cream and simmer gently 3 minutes.'],
    ['Toss', 'Turn off heat and stir in Parmesan and cooked pasta. Loosen with reserved pasta water if needed.'],
  ], {extraTools: ['Colander', 'Heatproof cup']}),
  'jp-french-onion-pork': recipe(['9 × 13-inch baking dish', 'Microwave-safe bowl with vented cover'], [
    ['Prepare sides', 'Heat oven to 375°F / 190°C. Cube potatoes, put in a microwave-safe bowl with {water:60}, cover loosely and microwave 8–12 minutes until almost tender. Drain carefully.'],
    ['Bake pork', 'Oil the baking dish. Arrange thawed pork chops in one layer; spread with onion dip and sprinkle cheddar on top. Bake 25–35 minutes, until pork reaches 145°F / 63°C, or cook further for the preferred texture. Rest 3 minutes. Thickness changes timing. Keep crispy onions dry and sprinkle only on the portions being eaten now.'],
    ['Finish sides', 'While pork cooks, add frozen broccoli to the potatoes, cover loosely and microwave 4–7 minutes, stirring halfway, until vegetables are tender and hot. Serve with pork.'],
  ]),
  'jp-beef-broccoli-rice': recipe(['Deep 5-quart sauté pan with lid'], [
    ['Brown', 'Dice onion and mince garlic. Cook beef and onion over medium-high 7–9 minutes to 160°F / 71°C. Stir in garlic, paprika, garlic powder and Italian herbs for 30 seconds.'],
    ['Cook rice', 'Add broth, dry long-grain rice and tomatoes with juices. Bring to a boil, cover and simmer on low 15 minutes.'],
    ['Add broccoli', 'Fold in frozen broccoli, cover and cook 7–10 minutes until rice is tender. Add hot water if dry and rice is firm. Top with cheddar and rest covered off heat 5 minutes.'],
  ]),
  'sm-meatball-subs': recipe(['Microwave-safe bowl with vented cover', 'Rimmed baking sheet'], [
    ['Heat filling', 'Heat oven to 400°F / 200°C. Put frozen fully cooked meatballs and marinara in the bowl. Cover loosely and microwave to the meatball package timing, stirring periodically, until centers reach 165°F / 74°C.'],
    ['Fill rolls', 'Split wheat sub rolls and arrange on the sheet. Fill with hot meatballs and sauce, then add mozzarella and Parmesan.'],
    ['Toast', 'Bake 5–8 minutes until rolls crisp at the edges and cheese melts. Keep spare filling separate from rolls.'],
  ]),
  'sm-fish-rice-bake': recipe(['9 × 13-inch baking dish with foil'], [
    ['Start rice', 'Heat oven to 375°F / 190°C. Whisk condensed mushroom soup with {water:400}, Italian herbs, garlic powder and onion powder in the dish. Stir in dry long-grain rice and frozen broccoli. Cover tightly and bake 40–50 minutes until rice is nearly tender.'],
    ['Add fish later', 'Stir rice carefully. If still firm and dry, add a splash of hot water. Lay thawed fish on top, brush with oil and sprinkle Parmesan. Cover and bake 12–18 minutes until fish reaches 145°F / 63°C and rice is tender.'],
    ['Rest', 'Let stand 5 minutes before dividing into portions. Starting the rice first prevents the fish from drying out.'],
  ]),
};

const vegetableWeights = {broccoli:1,frozenBroccoli:1,sprouts:1,spinach:1,kale:1,mushrooms:1,peppers:150,onion:150,zucchini:1,cabbage:1,carrots:1,frozenCarrots:1,tomatoes:1,freshTomato:1,cucumber:250,yellowSquash:1,asparagus:1,lettuce:1};
const rawProteins = new Set(['beef','turkey','pork','chicken','fish','salmon','shrimp','cubeSteak','italianSausage','italianLinks','shavedSteak','porkChops']);
export function enrichRecipes(recipes) {
  for (const r of recipes) {
    const entry = COOKBOOK[r.id] || r.cooking;
    if (!entry) throw Error(`Missing cooking instructions: ${r.id}`);
    r.steps = entry.steps;
    r.cookware = entry.vessels;
    r.dump = !!entry.dump;
    r.onePot = entry.vessels.length === 1 && ['pot','skillet'].includes(r.method);
    r.oneVessel = entry.vessels.length === 1;
    r.vegetableGrams = Math.round(r.ingredients.reduce((n,i)=>n+i.qty*(vegetableWeights[i.id]||0),0)/r.servings);
    const prep = r.dishes.filter(d=>!/(pot|pan|skillet|sheet|baking|basket|slow-cooker|couscous)/i.test(d));
    if (r.ingredients.some(i=>rawProteins.has(i.id)) || r.ingredients.some(i=>i.id==='eggs') || r.steps.some(s=>/\b(?:145|160|165)°F/.test(s.text))) prep.push('Food thermometer');
    if (entry.vessels.some(v=>/oven|baking|air-fryer/i.test(v)) || r.method==='pot') prep.push('Oven mitts');
    r.prepTools = [...new Set([...prep,...(entry.extraTools||[])])];
    r.dishes = [...r.cookware, ...r.prepTools];
    r.storage = r.kind==='snack' || r.method==='bowl'
      ? 'Keep perishable components covered in the refrigerator. Pack crackers, granola and other crunchy parts separately; combine at eating time.'
      : /air|tray/.test(r.method) || /tacos|quesadilla|subs|melts|sliders/.test(r.id)
        ? 'Pack the cooked filling, bread and sauces separately when possible. Reheat crisp parts in an oven or air fryer; reheat cooked leftovers to 165°F / 74°C. Add cold toppings afterward.'
        : 'Pack into individual shallow containers. Reheat only the portion you need to 165°F / 74°C, stirring halfway. Add a splash of water to rice, pasta or creamy sauces before reheating.';
  }
}

export function cookingSteps(recipe, scale = 1) {
  return recipe.steps.map(step=>({...step,text:step.text.replace(/\{water:(\d+)\}/g,(_,ml)=>`${quantity(Number(ml)*scale,'ml')} water`)}));
}

export const STORAGE_GUIDANCE = 'Refrigerate perishables in shallow containers within 2 hours (1 hour above 90°F), at 40°F or colder. The planner’s 1–2-day window is for texture. USDA advises using refrigerated cooked leftovers within 3–4 days.';
export const SAFETY_URL = 'https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart';
export const STORAGE_URL = 'https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/leftovers-and-food-safety';
