let circle_cache = {};
let blur_cache = {};

function light_set(light, r,g,b) {
    light.glow.tint = b | g<<8 | r<<16;

    // make bright lights become white
    const clamp = 30;
    mult = 1.5;

    const rgb = [r,g,b];
    const diff_arr = [0,0,0];
    for(let i = 0; i < 3; i++) {
        if(rgb[i] > clamp) {
            const diff = rgb[i] - clamp;

            for(let j = 0; j < 3; j++) {
                diff_arr[j] += diff * mult;
            }
        }
    }

    for(let i = 0; i < 3; i++) {
        rgb[i] += diff_arr[i];
        if(rgb[i] > 255) {
            rgb[i] = 255;
        }
        rgb[i] &= 0xff;
    }

    r = rgb[0];
    g = rgb[1];
    b = rgb[2];

    //light.led.tint = b | g<<8 | r<<16;
    light.led.tint = b | g<<8 | r<<16;

}

function create_viewport(renderer, sceneContainer, gameWidth, gameHeight) {
    const viewport = new Viewport.Viewport({
        screenWidth: renderer.width,
        screenHeight: renderer.height,
        worldWidth: gameWidth,
        worldHeight: gameHeight,

    });
    renderer.viewport = viewport;
    scale_scene(renderer);

    // add the viewport to the stage
    sceneContainer.addChild(viewport);
    return viewport;
}

function scale_scene(renderer) {
    if(renderer.viewport) {
        renderer.viewport.screenWidth = window.innerWidth;
        renderer.viewport.screenHeight = window.innerHeight;
        renderer.viewport.fitWorld();
        renderer.viewport.moveCenter(renderer.viewport_width/2, renderer.viewport_height/2);
    }
}

function render_circle(renderer, diameter) {
    if(circle_cache[diameter]) {
        return circle_cache[diameter];
    }

    const p = new PIXI.Graphics();
    p.beginFill(0xffffff);
    p.drawCircle(diameter/2, diameter/2, diameter/2);
    p.endFill();

    const t = PIXI.RenderTexture.create(diameter, diameter);
    renderer.render(p, t);
    p.destroy();

    circle_cache[diameter] = t;
    return t;
}

function render_blurred_circle(renderer, diameter, blur_diameter) {
    const key = '' + diameter + '_' + blur_diameter;
    if(blur_cache[key]) {
        return blur_cache[key];
    }

    const work_size = blur_diameter * 4;

    const sprite = new PIXI.Sprite(render_circle(renderer, diameter));
    sprite.anchor.set(0.5);
    sprite.x = work_size / 2;
    sprite.y = work_size / 2;

    const blur = new PIXI.filters.BlurFilter();
    blur.blur = blur_diameter;
    blur.quality = 7;

    const adjust = new PIXI.filters.AdjustmentFilter();
    adjust.brightness = 10;

    sprite.filters = [
        blur,
        adjust
    ];

    const t = PIXI.RenderTexture.create(work_size, work_size);
    renderer.render(sprite, t);
    sprite.destroy();

    blur_cache[key] = t;
    return t;
}

function create_pixel(renderer, diameter) {
    const sprite = new PIXI.Sprite(render_circle(renderer, diameter));
    const glow = new PIXI.Sprite(render_blurred_circle(renderer, diameter, diameter*2.3));
    // center the sprite's anchor point
    sprite.anchor.set(0.5);
    glow.anchor.set(0.5);
    // makes it render bloom nicer for some reason
    //sprite.rotation = 1;
    sprite.tint = 0x000000;
    glow.tint = 0x000000;

    // sprite.filters = [
    //     new PIXI.filters.AdvancedBloomFilter({
	// 		bloomScale : 2,
	// 		brightness : 1.5,
	// 		threshold : 0
	// 	})
    // ];

    return {
        'led': sprite,
        'glow': glow
    };
}

function create_array(app, x_count, y_count, x_gap, y_gap, led_diameter) {
    const total_width = (x_count+1) * x_gap;
    const total_height = (y_count+1) * y_gap;
    app.renderer.viewport_width = total_width;
    app.renderer.viewport_height = total_height;
    world_width = total_width;
    world_height = total_height;

    viewport = create_viewport(app.renderer, app.stage, total_width, total_height);
    viewport.pivot.x = -x_gap;
    viewport.pivot.y = -y_gap;
    
    viewport.interactive = true;
    viewport.on("touchstart", handleStart, false);
    viewport.on("touchendoutside", handleEnd, false);
    viewport.on("touchend", handleEnd, false);
    viewport.on("touchcancel", handleEnd, false);
    viewport.on("touchmove", handleMove, false);
    
    viewport.on("mousedown", mouseDown, false);
    viewport.on("mouseup", mouseUp, false);
    viewport.on("mouseupoutside", mouseUp, false);
    viewport.on("mousemove", mouseMove, false);

    // viewport.filters = [
    //     new PIXI.filters.AdvancedBloomFilter({
	// 		bloomScale : 50,
	// 		brightness : 15,
    //         threshold : 0,
    //         quality : 6
	// 	})
    // ];

    let leds = [];
    for(let y = 0; y < y_count; y++) {
		for(let x = 0; x < x_count; x++) {

            const light = create_pixel(app.renderer, led_diameter);
            // move the sprite to the center of the screen
            light.led.x = x * x_gap;
            light.glow.x = x * x_gap;
            light.led.y = y * y_gap;
            light.glow.y = y * y_gap;
            leds.push(light);

            let diff = 3;
            light_set(light, 0xff,0,0);
            if(x == 0 || x == x_count-1 || y == 0 || y == y_count-1) {
                light_set(light, 0,0xff,0);
            }
        }
    }
	
	// add in sequence to batch sprite types
	for(let i = 0; i < leds.length; i++) {
		viewport.addChild(leds[i].led);
	}
	for(let i = 0; i < leds.length; i++) {
		viewport.addChild(leds[i].glow);
	}

    return leds;

}

const app = new PIXI.Application({
    backgroundColor: 0,
    antialias: true,
    //resizeTo: document.body
    // width: window.innerWidth,
    // height: window.innerHeight
});
document.body.appendChild(app.view);

window.addEventListener('resize', resize);

// Resize function window
function resize() {
	// Resize the renderer
	app.renderer.resize(window.innerWidth, window.innerHeight);
    scale_scene(app.renderer);
}

resize();

let world_width = 0;
let world_height = 0;
const leds = create_array(app, 38, 49, 1/30*1000, 1/30*1000, 10);
let connected = false;
//console.log(leds);

app.ticker.add((delta) => {
    if(connected && socket.bufferedAmount < 256) {
        const payload = json_to_bin({
            "id":0,
            "module":"drs",
            "function":"tapeled_get",
            "params":[],
        });
        socket.send(payload);
    }
});

function send_touch(type, evt) {
    if(!connected)
        return;
    
    const world = app.renderer.viewport.toWorld(evt.data.global.x, evt.data.global.y);
    const x = world.x/world_width + 1/38;
    const y = world.y/world_height + 1/49;
    const width = 0.15;
    const height = 0.15;
    
    const payload = json_to_bin({
        "id":0,
        "module":"drs",
        "function":"touch_set",
        "params":[
            //[type,evt.data.identifier,evt.data.global.x,evt.data.global.y,1696,1312]
            [type,evt.data.identifier,x,y,width,height]
        ],
    });
    socket.send(payload);
}

function handleStart(evt) {
    // console.log(evt);
    // console.log("touchstart:", evt.data.identifier, evt.data.global.x, evt.data.global.y);
    send_touch(0, evt);
}

function handleMove(evt) {
    // console.log(evt);
    // console.log("touchmove:", evt.data.identifier, evt.data.global.x, evt.data.global.y);
    send_touch(2, evt);
}

function handleEnd(evt) {
    // console.log(evt);
    // console.log("touchend:", evt.data.identifier, evt.data.global.x, evt.data.global.y);
    send_touch(1, evt);
}

var mouseIsMoving = false;

function mouseDown(evt) {
    mouseIsMoving = true;
    handleStart(evt);
}

function mouseMove(evt) {
    if(mouseIsMoving) {
        handleMove(evt);
    }
}

function mouseUp(evt) {
    mouseIsMoving = false;
    handleEnd(evt);
}

function json_to_bin(json_obj) {
    const json_encoded = JSON.stringify(json_obj);
    return new TextEncoder().encode(json_encoded);
}

function bin_to_json(bin) {
    const decoded = new TextDecoder().decode(bin);
    return JSON.parse(decoded.replace('\0', ''));
}

let socket = undefined;
function new_websocket() {
    if (location.hostname == "") {
	socket = new WebSocket("ws://localhost:9002");
    } else {
	socket = new WebSocket(`ws://${location.hostname}:9002`);
    }

    socket.binaryType = "arraybuffer";

    socket.onopen = function(e) {
        console.log("[open] Connection established");
        connected = true;
    };

    socket.onmessage = function(event) {
        // console.log(`[message] Data received from server: ${event.data}`);
        // console.log(`[message] Data received from server:`, bin_to_json(event.data));
        const packet = bin_to_json(event.data);
        if(packet.error) {
            console.log("Bad response", packet);
            return;
        }
        const data = packet.data[0];
        
        if(!data)
            return;
        
        for(let i = 0; i < 38*49; i++) {
            let r = data[i*3]   & 0xfe;
            let g = data[i*3+1] & 0xfe;
            let b = data[i*3+2] & 0xfe;

            light_set(leds[i], r,g,b);
        }
    };

    socket.onclose = function(event) {
        connected = false;
        setTimeout(() => {new_websocket()}, 2000);
    };
}

new_websocket();
