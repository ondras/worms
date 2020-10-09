var Worms = OZ.Class();
Worms.prototype.init = function() {
	this._bg = OZ.DOM.elm("canvas", {position:"absolute", left:"0px", top:"0px"}).getContext("2d");
	this._fg = OZ.DOM.elm("canvas", {position:"absolute", left:"0px", top:"0px"}).getContext("2d");
	
	this._size = [0, 0]; /* in px */
	this._cellSize = [0, 0]; /* in px */
	this._tick = this._tick.bind(this);
	this._ec = [];

	this._options = {
		backgroundColor: "#000",
		padding: [100, 20, 20, 20],
		lineWidth: 4,
		gridColor: "#222",
		edgeColor: "#555",
		lineColor: "#f00",
		size: [40, 20],
		delay: 30,
		splitProbability: 0.003	// 2-cell worm has P = C/2, e.g. P = C * 0.5^(1/(length-1))
	}
	
	this._line = [];
	this._worms = [];
	this._edges = {
		horizontal: [],
		vertical: []
	};
	this._buildEdges();
	
	document.body.insertBefore(this._fg.canvas, document.body.firstChild);
	document.body.insertBefore(this._bg.canvas, document.body.firstChild);
	
	OZ.Event.add(window, "resize", this._sync.bind(this));
	OZ.Event.add(window, "DOMMouseScroll", this._wheel.bind(this));
	OZ.Event.add(window, "mousewheel", this._wheel.bind(this));
	OZ.Event.add(this._fg.canvas, "mousedown", this._mousedown.bind(this));
	
	this._info = {
		count: OZ.$("count"),
		total: OZ.$("total"),
		delay: OZ.$("delay")
	};
	this._total = 0;
	
	this._sync();

	var c = Math.round(this._options.size[0]/2);
	this._worms.push(this._addWorm(this._options.size[0]-1,	0,							Worm.EAST));
	this._worms.push(this._addWorm(this._options.size[0]-1,	this._options.size[1]-1,	Worm.SOUTH));
	this._worms.push(this._addWorm(0,						this._options.size[1]-1,	Worm.WEST));
	this._worms.push(this._addWorm(c,						0,							Worm.NORTH));
	this._worms.push(this._addWorm(c,						this._options.size[1]-1,	Worm.SOUTH));

	this._info.delay.innerHTML = this._options.delay;
	
	this._start();
}

Worms.prototype._buildEdges = function() {
	var w = this._options.size[0];
	var h = this._options.size[1];
	
	for (var i=0;i<w-1;i++) {
		this._edges.horizontal.push([]);
		for (var j=0;j<h;j++) {
			this._edges.horizontal[i].push(true);
		}
	}

	for (var i=0;i<w;i++) {
		this._edges.vertical.push([]);
		for (var j=0;j<h-1;j++) {
			this._edges.vertical[i].push(true);
		}
	}
}

Worms.prototype._addWorm = function(x, y, orientation) {
	var w = new Worm(x, y, orientation);
	this._total++;
	this._info.total.innerHTML = this._total;
	return w;
}

Worms.prototype._start = function() {
	this._ts = new Date().getTime();
	this._tick();
}

Worms.prototype._tick = function() {
	this._step();
	this._draw();
	setTimeout(this._tick, this._options.delay);
}

Worms.prototype._step = function() {
	var heads = {};
	
	for (var i=0;i<this._worms.length;i++) {
		var w = this._worms[i];
		this._moveWorm(w);
		
		var id = w.x+"-"+w.y;
		if (!(id in heads)) { heads[id] = []; }
		heads[id].push(w);
	}
	
	this._applyEating(heads);
	this._applyGrowth();
	this._applySplitting();
	
	this._info.count.innerHTML = this._worms.length;
}

Worms.prototype._applyEating = function(heads) {
	var d = Worm.DELTA;
	
	for (var id in heads) {
		var list = heads[id];
		if (list.length < 2) { continue; }
		
		/* find winner */
		list.sort(function(a,b){return b.length-a.length; });
		var winner = list.shift();
		var d = Worm.DELTA[winner.orientation];
		var x1 = winner.x - winner.length * d[0];
		var y1 = winner.y - winner.length * d[1];
		
		while (list.length) {
			var loser = list.shift();
			if (this._pathExists(x1, y1, d, -(winner.length+1))) {
				var index = this._worms.indexOf(loser);
				this._worms.splice(index, 1);
				winner.length++;
			}
		}
	}
}

Worms.prototype._applySplitting = function() {
	var newWorms = [];
	for (var i=0;i<this._worms.length;i++) {
		var w = this._worms[i];
		if (w.length == 1) { continue; }
		
		var prob = Math.pow(0.5, 1/(w.length-1)) * this._options.splitProbability;
		if (Math.random() >= prob) { continue; }
		
		/* split! */
		var d = Worm.DELTA[w.orientation];
		
		while (w.length) {
			var child = this._addWorm(w.x, w.y, w.orientation);
			w.x -= d[0];
			w.y -= d[1];
			w.length--;
			newWorms.push(child);
		}

		this._worms.splice(i, 1);
		i--;
	}
	while (newWorms.length) { this._worms.push(newWorms.shift()); }
}

Worms.prototype._applyGrowth = function() {
	var ts = new Date().getTime();
	
	for (var i=0;i<this._worms.length;i++) {
		var w = this._worms[i];
		if (w.age < w.maxAge) { continue; }

		/* is there space to grow? */
		var d = Worm.DELTA[w.orientation];
		var l = w.length;
		if (this._pathExists(w.x, w.y, d, -(l+1))) {
			w.age = 0;
			w.length++;
		}
	}
}

Worms.prototype._pathExists = function(x1, y1, delta, length) {
	/* out of grid */
	var x2 = x1 + length*delta[0];
	var y2 = y1 + length*delta[1];
	if (x2 < 0 || y2 < 0 || x2 >= this._options.size[0] || y2 >= this._options.size[1]) { return false; }
	
	/* check edges */
	var sign = (length < 0 ? -1 : 1);
	if (delta[0]*sign == -1) { x1--; }
	if (delta[1]*sign == -1) { y1--; }
	
	var edges = (delta[0] ? this._edges.horizontal : this._edges.vertical);
	
	for (var i=0;i<Math.abs(length);i++) {
		try {
			if (!edges[x1][y1]) { return false; }
		} catch (e) { /*debugger;*/ }
		x1 += sign * delta[0];
		y1 += sign * delta[1];
	}
	
	return true;
}

Worms.prototype._moveWorm = function(w) {
	var prob = [1, 1, 1, 1];
	
	this._adjustProbabilities(prob, w);
	
	var total = 0;
	for (var i=0;i<4;i++) { total += prob[i]; }
	var r = Math.random() * total;
	total = 0;
	while (prob.length) {
		total += prob.shift();
		if (total > r) {
			w.orientation = 3 - prob.length;
			break;
		}
	}
	
	var d = Worm.DELTA[w.orientation];
	w.x += w.length * d[0];
	w.y += w.length * d[1];
	
	w.age++;
}

Worms.prototype._adjustProbabilities = function(prob, w) {
	var d = Worm.DELTA;
	var l = w.length;

	for (var i=0;i<4;i++) {
		if (!this._pathExists(w.x, w.y, d[i], l)) { prob[i] = 0; }
	}
	
	/* do not want to turn backwards */
	prob[(w.orientation + 2) % 4] *= 0.1;
}

Worms.prototype._draw = function() {
	this._fg.clearRect(0, 0, this._size[0], this._size[1]);
	for (var i=0;i<this._worms.length;i++) {
		this._worms[i].draw(this._fg, this._cellSize, this._options.padding);
	}
	
	if (this._line.length > 1) {
		this._fg.strokeStyle = this._options.lineColor;
		this._fg.beginPath();
		this._fg.moveTo(this._line[0][0], this._line[0][1]);
		this._fg.lineTo(this._line[1][0], this._line[1][1]);
		this._fg.closePath();
		this._fg.stroke();
	}
}

Worms.prototype._sync = function() {
	this._size = OZ.DOM.win();
	this._bg.canvas.width = this._size[0];
	this._bg.canvas.height = this._size[1];
	this._fg.canvas.width = this._size[0];
	this._fg.canvas.height = this._size[1];
	
	this._bg.fillStyle = this._options.backgroundColor;
	this._bg.lineWidth = this._options.lineWidth;
	this._bg.lineCap = "round";
	this._bg.lineJoin = "round";

	this._fg.fillStyle = "#fff";
	this._fg.lineWidth = this._options.lineWidth;
	this._fg.lineCap = "round";
	this._fg.lineJoin = "round";
	
	/* compute cell size */
	var p = this._options.padding;
	var availWidth = this._size[0] - p[1] - p[3];
	var availHeight = this._size[1] - p[0] - p[2];
	this._cellSize[0] = availWidth / (this._options.size[0]-1);
	this._cellSize[1] = availHeight / (this._options.size[1]-1);
	
	this._drawBackground(); 
}

Worms.prototype._drawBackground = function() {
	var p = this._options.padding;
	this._bg.fillRect(0, 0, this._size[0], this._size[1]);

	this._bg.strokeStyle = this._options.gridColor;
	this._bg.beginPath();
	
	for (var i=0;i<this._options.size[0];i++) {
		/* column line */
		var x = p[3] + i * this._cellSize[0];
		var y1 = p[0];
		var y2 = this._size[1] - p[2];
		this._bg.moveTo(x, y1);
		this._bg.lineTo(x, y2);

		/* row lines */
		for (var j=0;j<this._options.size[1];j++) {
			var y = p[0] + j * this._cellSize[1];
			var x1 = p[3];
			var x2 = this._size[0] - p[1];
			this._bg.moveTo(x1, y);
			this._bg.lineTo(x2, y);
		}


	}
	this._bg.closePath();
	this._bg.stroke();

	this._bg.strokeStyle = this._options.edgeColor;
	this._bg.beginPath();
	
	var flag = false;
	
	/* horizontal edges */
	for (var j=0;j<this._edges.horizontal[0].length;j++) {
		flag = false;
		var y = p[0] + j*this._cellSize[1];
	
		for (var i=0;i<this._edges.horizontal.length;i++) {
			var x = p[3] + i*this._cellSize[0];
			var edge = this._edges.horizontal[i][j];
			
			if (edge && !flag) { /* start line */
				this._bg.moveTo(x, y);
				flag = true;
			} else if (!edge && flag) { /* end line */
				this._bg.lineTo(x, y);
				flag = false;
			}
		}
		if (flag) { this._bg.lineTo(p[3] + i*this._cellSize[0], y); }
	}
	
	/* vertical edges */
	for (var i=0;i<this._edges.vertical.length;i++) {
		flag = false;
		var x = p[3] + i*this._cellSize[0];
	
		for (var j=0;j<this._edges.vertical[i].length;j++) {
			var y = p[0] + j*this._cellSize[1];
			var edge = this._edges.vertical[i][j];
			
			if (edge && !flag) { /* start line */
				this._bg.moveTo(x, y);
				flag = true;
			} else if (!edge && flag) { /* end line */
				this._bg.lineTo(x, y);
				flag = false;
			}
		}
		if (flag) { this._bg.lineTo(x, p[0] + j*this._cellSize[1]); }
	}

	this._bg.closePath();
	this._bg.stroke();
}

Worms.prototype._wheel = function(e, elm) {
	var diff = (e.detail || e.wheelDelta/-40);
	this._options.delay = Math.max(0, this._options.delay + diff);
	this._info.delay.innerHTML = this._options.delay;
}

Worms.prototype._mousedown = function(e) {
	this._line = [[e.clientX, e.clientY]];
	this._ec.push(OZ.Event.add(this._fg.canvas, "mousemove", this._mousemove.bind(this)));
	this._ec.push(OZ.Event.add(this._fg.canvas, "mouseup", this._mouseup.bind(this)));
}

Worms.prototype._mousemove = function(e) {
	this._line[1] = [e.clientX, e.clientY];
	this._draw();
}

Worms.prototype._mouseup = function(e) {
	this._toggleEdges();
	this._line = [];
	while (this._ec.length) { OZ.Event.remove(this._ec.shift()); }
	this._drawBackground();
	this._draw();
}

/**
 * There is a line drawn. Toggle edges crossed by this line.
 */
Worms.prototype._toggleEdges = function() {
	var forbidden = {
		horizontal: {},
		vertical: {}
	};
	for (var i=0;i<this._worms.length;i++) {
		var w = this._worms[i];
		var d = Worm.DELTA[w.orientation];
		var what = (w.orientation % 2 ? forbidden.horizontal : forbidden.vertical);
		var x = w.x;
		var y = w.y;
		if (d[0] == 1) { x--; }
		if (d[1] == 1) { y--; }
		for (var l=0;l<w.length;l++) {
			what[x+"-"+y] = true;
			x -= d[0];
			y -= d[1];
		}
	}
	
	var l1 = this._line[0];
	var l2 = this._line[1];
	var p = this._options.padding;
	
	if (l1[1] != l2[1]) { /* check horizontals, line is not horizontal */
		var h = this._edges.horizontal;
		if (l2[1] < l1[1]) { /* swap for better order */
			l1 = this._line[1];
			l2 = this._line[0];
		}

		for (var j=0;j<h[0].length;j++) {
			var y = p[0] + j*this._cellSize[1];
			if (l1[1] > y || l2[1] < y) { continue; } /* can not cross this horizontal line */
			
			var x = l1[0] + (y - l1[1]) * (l2[0] - l1[0]) / (l2[1] - l1[1]); /* where does the line cross this horizontal */
			
			x -= p[3];
			x = Math.floor(x/this._cellSize[0]);
			
			if (x < 0 || x >= h.length) { continue; } /* no edge applicable */
			
			if (!(x+"-"+j in forbidden.horizontal)) { h[x][j] = !h[x][j]; } /* toggle edge */
		} /* for all horizontal lines */
	} /* horizontal check */
	
	if (l1[0] != l2[0]) { /* check verticals, line is not vertical */
		var v = this._edges.vertical;
		if (l2[0] < l1[0]) { /* swap for better order */
			l1 = this._line[1];
			l2 = this._line[0];
		}

		for (var i=0;i<v.length;i++) {
			var x = p[3] + i*this._cellSize[0];
			if (l1[0] > x || l2[0] < x) { continue; } /* can not cross this vertical line */
			
			var y = l1[1] + (x - l1[0]) * (l2[1] - l1[1]) / (l2[0] - l1[0]); /* where does the line cross this vertical */
			
			y -= p[0];
			y = Math.floor(y/this._cellSize[1]);
			
			if (y < 0 || y >= v[i].length) { continue; } /* no edge applicable */
			
			if (!(i+"-"+y in forbidden.vertical)) { v[i][y] = !v[i][y]; } /* toggle edge */
		} /* for all vertical lines */
	} /* vertical check */
	
}

var Worm = OZ.Class();

Worm.NORTH	= 0;
Worm.EAST	= 1;
Worm.SOUTH	= 2;
Worm.WEST	= 3;

Worm.DELTA = [
	[0, -1],
	[1,  0],
	[0,  1],
	[-1, 0]
];


Worm.prototype.init = function(x, y, orientation) {
	this.x = x;
	this.y = y;
	this.orientation = orientation;
	this.length = 1;
	this.age = 0;
	this.maxAge = 300 + Math.round(Math.random() * 500);
}

Worm.prototype.draw = function(context, cellSize, padding) {
	context.strokeStyle = "hsl(" + (this.length * 20) + ", 100%, 50%)";

	context.beginPath();
	
	var x = padding[3] + this.x * cellSize[0];
	var y = padding[0] + this.y * cellSize[1];
	context.moveTo(x, y);
	
	switch (this.orientation) {
		case Worm.NORTH:
			y += this.length * cellSize[1];
		break;
		case Worm.EAST:
			x -= this.length * cellSize[0];
		break;
		case Worm.SOUTH:
			y -= this.length * cellSize[1];
		break;
		case Worm.WEST:
			x += this.length * cellSize[0];
		break;
	}
	
	context.lineTo(x, y);
	
	context.closePath();
	context.stroke();



	context.beginPath();
	
	var x = padding[3] + this.x * cellSize[0];
	var y = padding[0] + this.y * cellSize[1];
	context.moveTo(x, y);
	context.arc(x, y, context.lineWidth * 0.75, 0, 2*Math.PI, true);
	
	context.closePath();
	context.fill();
}

