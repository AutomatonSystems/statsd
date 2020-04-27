import udp from 'dgram';

const TYPES = {
	COUNTER: 'c',
	GAUGE: 'g',
	TIMER: 'ms'
}

/**
 * Very basic statsd server for node; as I couldn't get any of the more advanced clients
 * working against our graphite endpoint
 * 
 */
export default class StatsD{

	/**
	 * 
	 * Create a new client; connecting to the host  an port provided.
	 * 
	 * @param {String} host 
	 * @param {Number} port 
	 */
	constructor(host, port=8125){
		this._host = host;
		this._port = port;
		this._client = null;

		this.sending = 0;
	}

	/**
	 * returns a (name)spaced proxy on this connection
	 * 
	 * @param {String} prefix 
	 * 
	 * @returns {StatsDProxy}
	 */
	space(prefix){
		return new StatsDProxy(this, prefix);
	}

	/**
	 * Gets (creating if required) the statsd connection
	 */
	get client(){
		if(this._client==null){
			this.sending = 0;
			this._client = udp.createSocket('udp4');
		}
		return this._client;
	}

	/**
	 * Use count for values that are countable over a time period;
	 * eg DB updates 
	 * 
	 * @param {String} key key to store the count against
	 * @param {Number} value value of the counter
	 * 
	 * @returns {StatsD}
	 */
	count(key, value=1){
		this._stat(key, value, TYPES.COUNTER);
		return this;
	}

	/**
	 * Use gauge for values that are measurable at a point in time
	 * eg CPU load
	 * 
	 * @param {String} key key to store the count against
	 * @param {Number} value value of the gauge
	 * 
	 * @returns {StatsD}
	 */
	gauge(key, value){
		this._stat(key, value, TYPES.GAUGE);
		return this;
	}

	/**
	 * Use time for an operation that the time taken to perform is of interest
	 * eg http request/response ms time taken
	 * 
	 * @param {String} key key to store the count against
	 * @param {Number} value time in ms the event took
	 * 
	 * @returns {StatsD}
	 */
	timer(key, value){
		this._stat(key, value, TYPES.TIMER);
		return this;
	}

	/**
	 * 
	 * Closes the statd connection; 
	 * 
	 * Waits 10s for active packets to send unless force=true.
	 * 
	 * @param {Boolean} force (false) if the 10s wait should be skipped
	 */
	close(force = false){
		if(this._client!=null){
			if(this.sending > 0 && !force){
				setTimeout(()=>{this.close(true)}, 10000);
			}else{
				this._client.close();
				this._client = null;
			}
		}
	}

	_stat(key, value, type){
		this._send(key, value, type);
	}

	_send(key, value, type){
		this.sending++;
		this.client.send(`${key}:${value}|${type}`, this._port, this._host,  (error)=>{
			this.sending--;
			if(error!=null)
				console.warn(error);
		});
	}
}

/**
 * Tiny utility class to help namespacing stats
 */
class StatsDProxy{

	/**
	 * 
	 * @param {StatsD} statsd 
	 * @param {String} prefix 
	 */
	constructor(statsd, prefix){
		this.parent = statsd;
		
		if(!prefix.endsWith('.')){
			prefix += '.';
		}
		this.prefix = prefix;
	}

	/**
	 * 
	 * @param {String} prefix 
	 * 
	 * @returns {StatsDProxy}
	 */
	space(prefix){
		return new StatsDProxy(this.parent, this.prefix + prefix);
	}

	/**
	 * Use count for values that are countable over a time period;
	 * eg DB updates 
	 * 
	 * @param {String} key key to store the count against
	 * @param {Number} value value of the counter
	 * 
	 * @returns {StatsDProxy}
	 */
	count(key, value=1){
		this.parent.count(this.prefix+key, value);
		return this;
	}

	/**
	 * Use gauge for values that are measurable at a point in time
	 * eg CPU load
	 * 
	 * @param {String} key key to store the count against
	 * @param {Number} value value of the gauge
	 * 
	 * @returns {StatsDProxy}
	 */
	gauge(key, value){
		this.parent.gauge(this.prefix+key, value);
		return this;
	}

	/**
	 * Use time for an operation that the time taken to perform is of interest
	 * eg http request/response ms time taken
	 * 
	 * @param {String} key key to store the count against
	 * @param {Number} value time in ms the event took
	 * 
	 * @returns {StatsDProxy}
	 */
	timer(key, value){
		this.parent.timer(this.prefix+key, value);
		return this;
	}
}