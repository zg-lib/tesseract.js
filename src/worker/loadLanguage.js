import pako from 'pako'
import db from './db'
import fileSizes from './fileSizes'

function getLanguageData(lang, progress, cb, url='https://cdn.rawgit.com/naptha/tessdata/gh-pages/3.02/'+lang+'.traineddata.gz'){
	var xhr = new XMLHttpRequest();
	xhr.responseType = 'arraybuffer';
	xhr.open('GET', url, true);
	xhr.onerror    = e => {
		xhr.onprogress = xhr.onload = null
		cb(xhr, null)
	}
	xhr.onprogress = e => progress({
		'loaded_lang_model': e.loaded/fileSizes[lang], //this is kinda wrong on safari
		cached: false
	})
	xhr.onload = e => {
		if (!(xhr.status == 200 || (xhr.status == 0 && xhr.response))) return cb(xhr, null);

		progress({'unzipping_lang_model': true})

		var response = new Uint8Array(xhr.response)
		while(response[0] == 0x1f && response[1] == 0x8b) response = pako.ungzip(response);

		progress({
			'unzipped_lang_model': true,
			'lang_model_size': response.length
		})

		cb(null, response)
	}
	
	progress({
		'loaded_lang_model': 0,
		cached: false,
		requesting: true
	})

	xhr.send()
}

// var loaded_langs = []

export default function loadLanguage(lang, jobId, cb, url){

	console.log('loadLanguage jobId', jobId)

	// if(loaded_langs.indexOf(lang) != -1) return cb(null, lang);

	function progressMessage(progress){
		postMessage({ jobId, progress })
	}	

	function finish(err, data) {
		if(err) return cb(err);
		// loaded_langs.push(lang)
		cb(null, data)
	}

	function createDataFile(err, data){
		progressMessage({ created_virtual_datafile: true})
		finish(err, data)
	}

	function createDataFileCached(err, data) {
		if(err) return createDataFile(err);

		db.put(lang, data, err => console.log('cached', lang, err))
		progressMessage({cached_lang: lang}) 
		createDataFile(null, data)
	}


	db.open({compression: false}, err => {
		if (err) return getLanguageData(lang, progressMessage, createDataFile, url);

		db.get(lang, (err, data) => {

			if (err) return getLanguageData(lang, progressMessage, createDataFileCached, url)

			while(data[0] == 0x1f && data[1] == 0x8b) data = pako.ungzip(data);

			progressMessage({ loaded_lang_model: lang, from_cache: true })

			cb(null, data)
		})
	})	
}