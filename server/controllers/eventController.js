const Event = require('../models/Event');




exports.getAllEvents = async (req, res) => {
    try{
        const filters = {};
        if(req.query.category) {
            filters.category = req.query.category;
        } 
        if (req.query.ticketPrice) {
            filters.ticketPrice = req.query.ticketPrice;
        }

        const events = await Event.find(filters);
        res.json(events);
    } catch (error) {
        res.status(500).json({error: error.message});
    }
}

exports.getEventById = async(req, res) =>{
    try{
        const event = await Event.findById(req.params.id);
        if(!event){
            return res.status(404).json({error: 'Event not found'});
        }
        res.json(event);
    } catch {
        res.status(500).json({error: error.message});
    }
}





exports.createEvent = async (req, res) => {
    try {
        const {
            title,
            description,
            date,
            location,
            category,
            totalSeats,
            ticketPrice,
            image
        } = req.body;

        // Validate required fields
        if (
            !title || !description || !date ||
            !location || !category ||
            totalSeats === undefined ||
            ticketPrice === undefined || !image
        ) {
            return res.status(400).json({
                message: 'All event fields are required'
            });
        }

        const event = await Event.create({
            title,
            description,
            date,
            location,
            category,
            totalSeats: Number(totalSeats),
            availableSeats: Number(totalSeats),
            ticketPrice: Number(ticketPrice),
            imageUrl: image,
            createdBy: req.user._id
        });

        res.status(201).json({
            message: 'Event created successfully',
            event
        });

    } catch (error) {
        console.error('Create Event Error:', error);

        res.status(500).json({
            message: 'Error creating event',
            error: error.message
        });
    }
};




exports.updateEvent = async(req, res) => {
        const {title, description, date, location, category, totaleSeat, availableSeats, ticketPrice, imageUrl} = req.body;
        try{
            const event = await Event.findByIdAndUpdate(req.params.id, {
             title,
            description,
            date,
            location,
            category,
            totaleSeat,
            availableSeats,
            ticketPrice,
            imageUrl 
            }, {new: true});
            if(!Event) {
                return res.status(404).json({error: 'Event not found'})
            }
            res.json(event);
        } catch (error) {
            res.status(500).json({error: error.message});
        }
};







exports.deleteEvent = async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id);

    if (!event) {
      return res.status(404).json({
        error: "Event Not Found",
      });
    }

    return res.status(200).json({
      message: "Event deleted successfully",
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message,
    });
  }
};
