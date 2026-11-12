const express = require('express')
const router = express.Router();
const {protect, admin} = require('../middleware/auth');

const {getAllEvents, getEventById, createEvent, updateEvent, deleteEvent} = require('../controllers/eventController')



// get all event 


router.get('/', getAllEvents);

// get Event by id 

router.get('/:id', getEventById)


// Create event (only Admin)

router.post('/', protect, admin, createEvent);

// update event (Admin only)

router.put('/:id', protect, admin, updateEvent);


router.delete('/:id', protect, admin, deleteEvent);



module.exports = router;