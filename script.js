'use strict';
const btnDeleteAll = document.querySelector('.btn-delete-all');

class Workout {
    date = new Date();
    id = (Date.now() + '').slice(-10);
    clicks = 0;

    constructor(coords, distance, duration) {
        this.coords = coords; // [lat, lng]
        this.distance = distance; //km
        this.duration = duration//min

    }

    _setDescription() {
        // prettier-ignore
        const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

        this.Description = `${this.type[0].toUpperCase()}${this.type.slice(1)} on ${months[this.date.getMonth()]} ${this.date.getDate()}`;
    }

    _click() {
        this.clicks++
    }
}

class Running extends Workout {
    type = 'running'
    constructor(coords, distance, duration, cadence) {
        super(coords, distance, duration);
        this.cadence = cadence;
        this.calcPace();
        this._setDescription();
    }

    calcPace() {
        //min/km
        this.pace = this.duration / this.distance
        return this.pace;
    }
}

class Cycling extends Workout {
    type = 'cycling';

    constructor(coords, distance, duration, elevationGain) {
        super(coords, distance, duration);
        this.elevationGain = elevationGain;
        this.calcSpeed();
        this._setDescription();
    }

    calcSpeed() {
        // km/h
        this.speed = this.distance / (this.duration / 60)
        return this.speed
    }
}

// APPLICATION ARCHITECHURE
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');



class App {
    #map;
    #mapZoomLevel = 13;
    #mapEvent;
    #workouts = [];
    #editingWorkoutId = null;
    #delitingWorkoutID = null;
    #markers = new Map();


    constructor() {

        //get users position
        this._getPosition();
        //get data from local storage
        this._getLocalStorage()

        //Attach event handlers
        form.addEventListener('submit', this._newWorkout.bind(this));
        inputType.addEventListener('change', this._toggleElevationField);
        containerWorkouts.addEventListener('click', this._moveToPopup.bind(this));
        btnDeleteAll.addEventListener('click', this._deleteAllWorkouts.bind(this));
        this._sortSelect = document.querySelector('.sort-select');
        this._sortSelect.addEventListener('change', this._sortWorkouts.bind(this));

    }

    _getPosition() {
        if (navigator.geolocation)
            navigator.geolocation.getCurrentPosition(this._loadMap.bind(this),
                function () {
                    alert('Could not get your position');
                });
    }

    _loadMap(position) {
        const { latitude } = position.coords
        const { longitude } = position.coords


        const coords = [latitude, longitude]

        this.#map = L.map('map').setView(coords, this.#mapZoomLevel);



        L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(this.#map);


        //Handling clicks on map
        this.#map.on('click', this._showForm.bind(this))

        this.#workouts.forEach(work => { this._renderWorkoutMarker(work) });
    }

    _showForm(mapE) {
        this.#mapEvent = mapE;
        form.classList.remove('hidden');
        inputDistance.focus();
    }

    _hideForm() {
        //empty inputs
        inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';

        form.style.display = 'none';
        form.classList.add('hidden');
        setTimeout(() => form.style.display = 'grid', 1000);

    }


    _toggleElevationField() {
        inputElevation.closest('.form__row').classList.toggle('form__row--hidden')
        inputCadence.closest('.form__row').classList.toggle('form__row--hidden')

    }

    _newWorkout(e) {
        const validInputs = (...inputs) => inputs.every(inp => Number.isFinite(inp));
        const allPositive = (...inputs) => inputs.every(inp => inp > 0);

        e.preventDefault();

        // Get data from form
        const type = inputType.value;
        const distance = +inputDistance.value;
        const duration = +inputDuration.value;

        // ========== ADD THIS EDIT LOGIC HERE ==========
        if (this.#editingWorkoutId) {
            // Find the workout to edit
            const workout = this.#workouts.find(work => work.id === this.#editingWorkoutId);

            if (type === 'running') {
                const cadence = +inputCadence.value;


                // Validate
                if (!validInputs(distance, duration, cadence) ||
                    !allPositive(distance, duration, cadence))
                    return alert('Inputs have to be positive numbers!');

                // Update properties
                workout.distance = distance;
                workout.duration = duration;
                workout.cadence = cadence;

            }

            if (type === 'cycling') {
                const elevation = +inputElevation.value;

                // Validate
                if (!validInputs(distance, duration, elevation) ||
                    !allPositive(distance, duration))
                    return alert('Inputs have to be positive numbers!');

                // Update properties
                workout.distance = distance;
                workout.duration = duration;
                workout.elevationGain = elevation;
                if (type === 'running') {
                    const cadence = +inputCadence.value;

                    if (!validInputs(distance, duration, cadence) ||
                        !allPositive(distance, duration, cadence))
                        return alert('Inputs have to be positive numbers!');

                    // Update properties
                    workout.distance = distance;
                    workout.duration = duration;
                    workout.cadence = cadence;
                    workout.pace = duration / distance; // ← Calculate manually
                }

                if (type === 'cycling') {
                    const elevation = +inputElevation.value;

                    if (!validInputs(distance, duration, elevation) ||
                        !allPositive(distance, duration))
                        return alert('Inputs have to be positive numbers!');

                    // Update properties
                    workout.distance = distance;
                    workout.duration = duration;
                    workout.elevationGain = elevation;
                    workout.speed = distance / (duration / 60); // ← Calculate manually
                }
            }

            console.log('About to re-render workouts');
            this._renderAllWorkouts();
            console.log('Finished re-rendering');

            // Update local storage
            this._setLocalStorage();

            // Reset edit mode
            this.#editingWorkoutId = null;

            // Hide form
            this._hideForm();

            return;
        }
        // ========== END OF EDIT LOGIC ==========

        // EXISTING CREATE LOGIC BELOW (don't change)
        const { lat, lng } = this.#mapEvent.latlng;
        let workout;

        //if running , create running object
        if (type === 'running') {
            const cadence = +inputCadence.value

            //check if data is valid
            if (!validInputs(distance, duration, cadence) ||
                !allPositive(distance, duration, cadence))
                return alert('Inputs have to be positive numbers!');

            workout = new Running([lat, lng], distance, duration, cadence);
        }

        //if cycling , create cycling object
        if (type === 'cycling') {
            const elevation = +inputElevation.value
            //check if data is valid
            if (!validInputs(distance, duration, elevation) ||
                !allPositive(distance, duration))
                return alert('Inputs have to be positive numbers!');

            workout = new Cycling([lat, lng], distance, duration, elevation);
        }

        //add new obj work out
        this.#workouts.push(workout);

        //render work out in map as marker
        this._renderWorkoutMarker(workout);
        this._renderWorkout(workout);

        //clear input fields
        this._hideForm()

        //set localstorage to all workouts
        this._setLocalStorage();
    }

    _renderWorkoutMarker(workout) {
        const marker = L.marker(workout.coords)
            .addTo(this.#map)
            .bindPopup(
                L.popup({
                    maxWidth: 250,
                    minWidth: 100,
                    autoClose: false,
                    closeOnClick: false,
                    className: `${workout.type}-popup`,
                })
            )
            .setPopupContent(`${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.Description}`)
            .openPopup();

        // Store marker by workout ID
        this.#markers.set(workout.id, marker);
    }

    _renderWorkout(workout) {
        let html = `
        <li class="workout workout--${workout.type}" data-id="${workout.id}">
            <button class="workout__edit">Edit</button>
            <button class='workout__delete'>Delete</button>
          <h2 class="workout__title">${workout.Description}</h2>
          <div class="workout__details">
            <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
            <span class="workout__value">${workout.distance}</span>
            <span class="workout__unit">km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⏱</span>
            <span class="workout__value">${workout.duration}</span>
            <span class="workout__unit">min</span>
          </div>
          `;
        if (workout.type === 'running')
            html +=
                `<div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>`

        if (workout.type === 'cycling')
            html += `
        <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.speed.toFixed(1)}</span>
            <span class="workout__unit">km/h</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">⛰</span>
            <span class="workout__value">${workout.elevationGain}</span>
            <span class="workout__unit">m</span>
          </div>
        </li>`;

        form.insertAdjacentHTML('afterend', html);
    }

    _renderAllWorkouts() {
        // Clear all existing workout cards
        const workouts = document.querySelectorAll('.workout');
        workouts.forEach(work => work.remove());

        // Re-render all workouts
        this.#workouts.forEach(work => {
            this._renderWorkout(work);
        });
    }

    _moveToPopup(e) {


        const workoutEl = e.target.closest('.workout')


        if (!workoutEl) return;

        if (e.target.classList.contains('workout__edit')) {
            const workoutEl = e.target.closest('.workout');
            const workoutId = workoutEl.dataset.id;

            console.log('Edit workout with ID:', workoutId);

            // Call edit method
            this._editWorkout(workoutId);
            return;
        }

        if (e.target.classList.contains('workout__delete')) {
            const workoutEl = e.target.closest('.workout');
            const workoutId = workoutEl.dataset.id;

            console.log('Delete workout with ID:', workoutId);

            this._deleteWorkout(workoutId);
            return;
        }

        const workout = this.#workouts.find(work => work.id === workoutEl.dataset.id)


        this.#map.setView(workout.coords, this.#mapZoomLevel, {
            animate: true,
            pan: {
                duration: 1,
            }
        })

        // workout._click()
    }

    _setLocalStorage() {
        localStorage.setItem('workouts', JSON.stringify(this.#workouts));
    }

    _getLocalStorage() {
        const data = JSON.parse(localStorage.getItem('workouts'));



        if (!data) return;

        this.#workouts = data;

        this.#workouts.forEach(work => { this._renderWorkout(work) });
    }

    _editWorkout(id) {
        // Find the workout
        const workout = this.#workouts.find(work => work.id === id);

        if (!workout) return;

        console.log('Editing workout:', workout);

        // Set edit mode
        this.#editingWorkoutId = id;

        // Pre-fill form with workout data
        inputType.value = workout.type;
        inputDistance.value = workout.distance;
        inputDuration.value = workout.duration;

        if (workout.type === 'running') {
            inputCadence.value = workout.cadence;
        }

        if (workout.type === 'cycling') {
            inputElevation.value = workout.elevationGain;
        }

        // Show correct input field (cadence or elevation)
        this._toggleElevationField();

        // Show the form
        form.classList.remove('hidden');
        inputDistance.focus();
    }

    _deleteWorkout(id) {
        // Remove from array
        this.#workouts = this.#workouts.filter(work => work.id !== id);

        // Remove marker from map
        const marker = this.#markers.get(id);
        if (marker) {
            this.#map.removeLayer(marker);
            this.#markers.delete(id);
        }

        // Update UI
        this._renderAllWorkouts();

        // Update local storage
        this._setLocalStorage();

        console.log(`Workout with ID ${id} deleted`);
    }

    _deleteAllWorkouts() {

        const confirmDelete = confirm('Are you sure you want to delete all workouts? This cannot be undone.');

        if (!confirmDelete) return;
        // 1. Clear workouts array
        this.#workouts = [];

        // 2. Remove all markers from map
        this.#markers.forEach(marker => this.#map.removeLayer(marker));
        this.#markers.clear();

        // 3. Remove all workout elements from UI
        const workouts = document.querySelectorAll('.workout');
        workouts.forEach(work => work.remove());

        // 4. Clear local storage
        localStorage.removeItem('workouts');

        console.log('All workouts deleted');
    }

    _sortWorkouts(e) {
        const criteria = e.target.value;

        // Clone to avoid mutating original
        const sorted = [...this.#workouts];

        if (criteria === 'distance') sorted.sort((a, b) => b.distance - a.distance);
        if (criteria === 'duration') sorted.sort((a, b) => b.duration - a.duration);
        if (criteria === 'date') sorted.sort((a, b) => new Date(b.date) - new Date(a.date));

        // Clear and re-render
        const workouts = document.querySelectorAll('.workout');
        workouts.forEach(work => work.remove());

        sorted.forEach(work => this._renderWorkout(work));
    }


    reset() {
        localStorage.removeItem('workouts');
        location.reload();
    }
}

const app = new App();