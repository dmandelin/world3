# Goals

I've always loved games such as *Civilization* or *Europa Universalis*
that simulate the growth of nations, development of society and technology,
and let me "play at the world". They also prompted a lot of questions:
What was it really like? How did things really work? I always thought
it would be interesting to have a "realistic" model informed by the
latest research, whether or not it was a fun game.

Separately, I've also long been curious about history and society. Why
do the nations and states we have today exist in this form? Why did
people really decide to hold republican assemblies or expand to universal
suffrage? Why did science and technology seem to advance quickly in
certain times and places? Could understanding these dynamics help us
navigate life today and in the future?

The dream project would be something that could model all those things
in detail for all of human (pre)history. That is way too vast for a
starting point, so I am scoping down to the emergence of some of the
"first" "cities" in the world, in southern Mesopotamia around 4000 BC, 
starting from the initial peopling of the region somewhere around 6500 BC.

That will be a complete model for one example of a transition over time
from groups of hunter-gatherers to cities, states, specialized social
roles, extensive and intensive trade networks. Specific things I really
want to explore with the model:

*   Agents (clans, leaders, groups, etc.) should act with reasonable
    motivations according to culture and psychology.
*   There should be subjective and objective ratings of how well agents
    are doing: satisfaction, thriving, health, etc.
*   Agents should have opinions on each other, especially on how aligned
    they are, and how powerful they are, possibly also encompassing things
    like prestige, trustworthiness, and even detailed assessments. They
    should also exchange these opinions with each other. Combined with
    events, these should lead to complex patterns of cooperation, conflict,
    affinity, and alliance.
*   Social structures (ritual authority, political authority, markets, etc)
    should arise out of the motivations and interactions of the agents.
    Massive oversimplification will be necessary, but I want to model 
    some micro aspects of the "phase transitions" between different
    political systems and structures. 
    *   For example, accumulating points toward "ranked chiefdom" is
        too abstract. I want at least one more level of detail, such
        as showing increasing competition for influence leading to
        stabler advantages for certain clans.
*   Population change and effects on scale and structure
    *   Realistic population change model including effects of disease
    *   Scale and density increasing innovation, disease, crime,
        infrastructural efficiency, etc
    *   Networks of interacting settlements of different sizes
    *   Migration, founding and abandonment of settlements
*   Elaboration, decay, merging, and splitting of cultures
*   Different personality and culture traits and their interaction
    with events and social structures

# Technical Requirements

The initial focus is on simplicity of deployment and testing. The tentative
architecture is a simple TypeScript-based web app that can be loaded up and
run locally.
*   Dependencies should be relatively light
*   Everything should be workable for open-source usage, distributed
    development, no platform lock-in
*   UI should be responsive: no slow/heavyweight frameworks
*   Should be usable on mobile. Phones are pretty small so it doesn't have
    to be great, but should be possible to demo. Should be well usable
    on tablets, including having appropriate standard gesture-oriented
    interactions instead of being always mouse-oriented.

It would be useful to have these at some point:
*   Saving and restoring simulation state
*   Running simulation updates in parallel
*   Running the simulation on separate servers

Designing a full simulation engine to support the project is probably
too much, but there should be various reusable patterns and components,
especially around things such as:

*   State tracking
*   State history recording, including graphical views
*   Maintaining consistent time and scheduling
*   Displaying tabular views of clans in a settlement, production
    activity, etc.
*   Displaying tooltips and other detailed views in the UI
*   Displaying detailed calculations showing where numbers come from
*   Navigating to UI views of different simulation entities and back
*   Notifications and event logs

Though calling generative AI inside the simulation won't be an initial
focus, it could be very relevant at some point for things like:

*   Agent decision-making
*   Summarizing agent/world state
*   Generating "news reports" on recent developments
*   Generating special events
*   Diplomatic interactions
*   Narrative dramatizations of simulation events

# Initial Model Description

The initial model will focus on the early stages of the project scope,
developments from start until communities start to become too big for
"everyone to know everyone" (see also Dunbar's number) and "something
else" has to happen in society. At first, that can be mainly the splitting
off of new villages, but we'll want to portray that process in some detail
if possible, and we'll need some model for the relationships among the
new villages. We will also want to have some social and infrastructural
options that are useful in settlements starting to expand toward "towns".

For now, agents will always be clans, but we'll also want to have the
possibility of having leader personalities that affect clan behavior,
and maybe eventually leaders as agents on their own.
*   **Women, children, and elders will always be meaningfully represented
    in the model.** 
    *   A minimal version would be for any population group
        (clans, initially) to have a mini-population pyramid with gender
        categories and 3-5 age categories. 
    *   All models will be developed to
        include realistic assumptions about family formation and caretaking.
        For example, clans should have to have some actual kinds of relationships
        with other clans or communities, or urban facilities for meeting
        marriage partners (e.g., local religious meetings). 
*   Personality and culture should also be incorporated early.
    *   Special personality traits such as neurodivergence appear to be
        particularly common among artists, prophets, and other innovators
    *   Many other things are influenced by personality and culture, such
        as the propensity to migrate, risk tolerance, and time preference.

One of the core aspects of the entire simulation will be that agents want
things, then try to get those things. We will need ways to track what things
agents want and to compare the appeal of different states of the world,
so they can use that to make decisions. These could be utility functions,
but they could also be other models such as "need" meters that become
increasingly motivational as need builds up. Clans will want/need:

*   Food
    *   Enough quantity
    *   Quality/variety: better taste and nutrition
    *   Security: one bad year could be fatal with no help or backup plan
    *   Production model should incorporate climate, technology, skill, 
        tools, infrastructure, economies of scale
        *   Need appropriate land ownership/access 
        *   Need different levels of land quality/yield. Better land will
            tend to get used up first; eventually there might be a lot of
            competition for it. Some land will be naturally farmable, others
            will need various levels of clearance or irrigation.
        *   There should be costs and benefits to investing, e.g., build
            granary, terrace hills, condition soil, improve lots of little
            local details
        *   Newcomers should want to learn from people who have been there
            longer
        *   Rituals may embed productive knowledge and facilitate productive
            activity
        *   Slow development and transmission of technology over time
*   Shelter: increasing permanence and complexity over time
*   Community: Clans will want some sort of relationship with other clans.
    *   This could depend on personality, and some clans might even prefer
        to be isolated, or bandits.
    *   This can have all kinds of practical benefits, but people are
        probably mostly motivated by more immediate concerns, such as
        gossip, company, hearing news, finding marriage partners, following
        customary patterns, keeping the peace, etc.
    *   When there is more competition or conflict, there will also be an
        increased desire for allies.
*   Divine community
    *   Religion is incredibly complex and variable, and has many components.
        In general I'll have to be selective, but one really critical
        aspect I think it makes to start with is: people's desire for a
        relationship with their ancestors and powerful beings in the world.
        Those are natural things to want, and can motivate all sorts of
        generative activity, such as wanting to build a house mor beautiful
        than all others to honor a divine founder of a town, and all the
        planning, organization, science, technology, and art that would take.
    *   This will also be an early ground for social negotiation and
        development of complexity:
        *   As settlements grow, ritual calendars and spaces fill; it may
            become logistically impossible to keep old ways.
        *   As complexity and impressiveness grows, more specialization
            may be needed. Leadership may become more restricted to people
            with certain reputation or credentials. There may be conflict
            and debate over these things.
*   Prestige: Clans will want other clans to respect them.
    *   Motivations around this may have to change for many people as
        socities become larger, perhaps looking for respect in smaller
        or more specialized groups; or substitutes such as general social
        equality or personalized religious activity
*   "Luxury": Everything people just like, for comfort, entertainment,
    novelty; supernormal stimuli
    *   May be motivating all by themselves, but can be very culturally
        shaped, e.g, becoming status markers

Conflict as in warfare and the like won't be a significant focus of
the simulation at first. One reason is that archaeologically, there
seems to have been less conflict in our early setting than in many
places. Also, conflict is a major feature that's been explored
greatly in existing games, so I'm motivated to emphasize other factors
instead. Finally, there are many sensitive issues to be considered
carefully in order to build any kind of realistic model. That said,
war has historically been a major motivation for migration, technological
development, administrative development, and solidarity generally:
once our simulation reaches a period where those effects become
significant, we'll have to include them.

Identity will be a major theme. Clans should have notions about who
they belong to: allies, nested kinship networks, local place identities,
etc. Eventually larger scale identities will appear to compete with
these, but in the early stage marriage and kinship (real or imputed)
are probably the main components of this.

Ideally, the simulation will be somewhat flexible about how long a time
step is, but at first one step will probably be between 1 and 20 years
of simulation-world time. The sequence for a step will be something like:

*   Evaluate: Agents evaluate their current state and knowledge
    *   Update happiness-type assessments based on current state and
        recent events
    *   Update expectations and norms based on recent experience
    *   Update opinions and knowledge of other agents
*   Decide: Agents decide what actions and policies to take: labor allocations,
    diplomatic, trade, or construction initiatives, etc.
    *   Nature also decides: There can be variable climate or disasters.
*   Step: Carry out effects of decisions
    *   Migrate: Agents move to a new location
    *   Produce: Produce goods, buildings, rituals, etc.
    *   Distribute: Goods to/and from producers, users, and stores
    *   Consume: Register effects of goods and rituals on recipients
    *   Population change: Update population for births and deaths
*   Record: Record part of state for history tracking and graphing

A critical aspect of the early model is giving clans ways to help or
hurt each other, so they can develop different kinds of relationships.
We also need to consider how much different clans interact with each
other, and how much they know each other. In a small village, they
may all interact dyadically as well as gathering all together or in
other groupings, and we can track all those details. But if a settlement
expands to, say 1000 people, that won't be possible any more. Much 
more work is needed to elaborate the model in that case, but ideas
include:

*   Increased conflict, free riding, aggression, etc. when people are
    unobserved or think they can't be tracked
*   Direct appeal loss for people who have customs and culture of
    expecting to live in a tight community
*   Increased use of clan symbols, luxury markers, religious symbols,
    etc. to have prestige with casual observers
*   Splitting into neighborhood areas or phratries where each can be
    a coherent community, with some agreement or expectations for how
    they interact
*   Local powerful clans, "big men" or religious societies:
    *   Taking on policing and dispute resolution functions
    *   Sponsoring amenities such as meeting houses that give more
        people a reason to want to live nearby

In general, at first if settlement sizes start to cause strain, people
should mostly found new villages nearby that maintain some sort of
relationship. (Typically people would have relatives in the mother
village, maybe important ritual sites too.) But it seems that after
there got to be 3-12 villages in a certain area, there would often
start to develop some sort of town. Precisely why things would tend
to develop in that way is unclear, but it's natural to guess that with
an area population of 1000-5000 or more, certain types of common
infrastructure such as market places and "temples" become viable,
and these create more "amenities" and "jobs", creating some pull for
that location.

The very first important clan interactions would be:

*   Marriage: Being able to marry each other, or having some marriages
    between the two clans creating an affinity
*   Community: Being available for ordinary conversation, favor exchanges,
    minor festivals, etc; at first this might be all equal but with
    many clans in a settlement not everyone can interact with everyone
    all the time
    *   Exchange of gossip and transmitting opinions on various subjects,
        especially reputation of agents is an important part of this
    *   Also learning of skills, technology, habits, etc.
*   Major rituals: If split out from community, perhaps because they
    have different inputs and effects
*   Mutual help: Disaster insurance (vs floods, lost harvest, lost
    livestock, long sickness) as well as help on smaller things; 
    if game turns are long these probably depend on a gift-exchange
    type relationship throughout the turn; but if short they could
    be tit-for-tat based on actual turn actions.
*   Dispute: Over a marriage, divorce, inheritance, fight, theft, etc.
    Clans might resolve themselves, or look to a mediator, or a village
    assembly, etc., with different results and effects on prestige
    and social structure

Other interactions that could be important at some point:

*   Throw feast: Some background feasting can be assumed, but there could
    be choices of how rich of feasts to throw, or to throw special ones.
*   Build together: flood control systems, irrigation ditches, ritual
    buildings too big for one clan to build. Leadership structure and
    incentives could vary.
*   Talk up/down clan: Spread good or bad information about another clan
    to influence opinions of them.
*   Provide aid: For a disaster or more mundane situations, but outside
    of a mutual help relationship; would tend to create a status difference
*   Provide gifts: Food or trade goods, beyond the usual amounts
*   Demonstrate exceptional skill: Produce great ritual, performance, or
    work of art
*   Crisis actions: Random crisis events might provide opportunities to
    organize a defense, hold a special ritual, etc.
*   Claim land/resource/ritual: Assert a claim to land, resource, or ritual
    held in common or by another clan
*   Innovate style: Adopt a new style of dress, ritual, etc.
*   Establish trade relationship: Could take many forms
*   Establish ancestor relationship: discover/create an ancestor to link
    two clans

A key element to explore with these relationships is, what exactly is the
relationship between one clan and another:

*   Do they consider themselves members of the same community?
*   Are they:
    *   Peers in a set of social norms that specifically emphasize equality?
    *   Equal-ish but recognizing some differences in status based on key
        factors such as wealth or size?
    *   One recognizes the other as higher status based on qualities (and might 
        defer in certain matters, etc.) but not in a separate category?
    *   One recognizes the other as higher status in an explicit system
        (e.g., special societies to join, ranks to achieve, or lineages
        to belong to)
*   Does clan A look to learn from clan B, as teachers, exemplars, etc.?
    Also for other roles such as judging or regulating trade. And there
    can be a distinction between clan A simply looking to clan B because,
    all things considered that's what they want to do, and later on
    certain roles being more explicitly reserved for specialists.

# Initial User Interface

There should be some sort of map view, looking similar to an actual map.
Mainly it can show key geographic features (major rivers and terrain types)
and settlements. There can also be overlays and icons to show settlement
features, trade relationships, and things like that. However, the map
should probably be 1/3 or less of the display most of the time; or maybe
in the main display it should be highly abstracted, showing more the
people relationships than spatial (as people at the time tended to map
things), as we aren't pushing pieces around and don't have a lot to show
on the map yet.

The main action will be panels to navigate the information architecture
in detail:
*   World summary information (and top clans, etc)
*   Regions
*   Settlement hierarchy (be able to view cluster as a whole, but also
    individual towns and villages)
*   Clans and their attributes, especially their evaluations and why
    they're doing what they're doing
    *   And relationships among clans
*   Demographic changes and effects

In general, we should think of this as mainly a 0-player simulation, where
the human user will mostly watch it go. However, there should be different
control modes:
*   Simulation: user can view any details and change any policies and
    actions of any agent
*   Game: user controls one agent only, limited visibility about anything
    else
*   Hybrid: user is presented view from one agent and controls that agent
    only, but can view full data on any agent
At first, simulation mode is the most important, but we should be able to
at least "star" certain agents so we can more easily follow them over time
in the UI.

Although presentation is not a major focus, I have found that it has a
meaningful impact on even prototype projects. I want at least:

*   Reasonably appealing and lightly thematic fonts, layouts, and color
    schemes
*   Use icons to expression information more compactly when applicable
*   Lots of tooltips and drilldowns to source the computations that go
    into different values
*   Some use of imagery to bring things to life and dramatize certain
    changes:
    *   Show some sort of settlement images, use them to help show
        settlement size and type
    *   Some sort of images of people/clans

# Other points

Other points to incorporate that I've come up with over time but don't
necessarily systematically fit in the above:

*   Growth of tells over time: This will be a key way of visualizing the
    size and persistence of settlements.
*   Increasing settlement permanence: At first, more hunting and gathering,
    and river shifts might force many settlements to move every several
    generations. But over time people learn to control the floods and
    create more persistent settlements.
*   Occasional big floods with bigger effects, both on people and
    production, but also with cultural responses.
*   Clans should have different levels of skill or technology in key
    activities such as fishing, farming, ritual, irrigation, pottery.
    They should improve with practice and learning from each other, but
    in a noisy evolutionary way: innovations can also lower output.
    They should imitate who they think is successful, so that symbols
    of success can start to influence learning. This also provides
    scope for specializing in certain skills.
    *   More work is needed on these concepts but it seems that skill
        and technology are somewhat separable, but also overlap. E.g.,
        if for a period of time no one has any actual skill in using
        a certain technology, it will probably be lost. We don't
        necessarily need all these right away (or ever), but a full
        model might feature these:
        *   Discrete technological inventions or packages that clans
            can either have or not (and transmit to each other). These
            probably appear somewhat rarely and might depend on special
            confluences of personality, culture, resources, etc. For
            our initial period we might have just a few of these, maybe
            each worth something like 1-10% productivity
        *   Incremental improvements in the discrete tech package.
            This is transmittable, persistent knowledge about how to
            do things a bit better, e.g., incrementally higher crop
            yields via better seeds, or incremental improvements in
            efficiency of a base farming plow and tool kit. These might
            appear more often, in smaller units. They can also be
            transmitted. Vehicles such as tools, writing, and apprenticeship
            institutions can speed transmission, and thus overall
            development. These can also be kept as trade secrets.
        *   Individual skill: Even given the same library of tools and
            techniques, practitioners will vary in effectiveness. Some
            of that can be from personality factors: e.g., a warrior
            personality is probably not as good at being an industrious
            farmer and vice versa.
        *   One way to slice tech vs skill is to assume that each clan
            is drawing on a "field of knowledge" they have access to
            (via clan elders, neighbors, writings, etc.) to educate
            themselves how to do things. Their resources and efforts
            there will determine their tech level -- what they're trying
            to achieve. But then they need to actually put those skills
            into practice to gain skill and produce results. And those
            results then become the field of knowledge for the next
            simulation step.
*   Food availability, stationarity, and disease should all affect
    population changes. Agriculture, population density, and connection
    should boost disease.
*   There should be at least a handful of significant local facilities
    for people to build and maintain: meeting place (at various levels),
    ditching/irrigation, market place, granary, kiln, pottery wheel.
