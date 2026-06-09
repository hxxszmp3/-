with open('index.html', 'r', encoding='utf-8') as f:
    h = f.read()

# === 1. Enhanced doSearch with smart matching ===
old_doSearch = '''function doSearch() {
  var query = document.getElementById('searchInput').value.trim();
  if (!query) { showToast('请输入歌手名或歌曲名'); return; }
  var container = document.getElementById('resultsContainer');
  container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  setTimeout(function() {
    var results = [];
    var q = query.toLowerCase();
    var singerKeys = Object.keys(songDB);
    var seen = {};

    for (var i = 0; i < singerKeys.length; i++) {
      var singer = singerKeys[i];
      var songs = songDB[singer];
      var singerMatch = singer.toLowerCase().indexOf(q) !== -1;

      for (var j = 0; j < songs.length; j++) {
        var songMatch = songs[j].name.toLowerCase().indexOf(q) !== -1;
        if (singerMatch || songMatch) {
          var key = singer + '||' + songs[j].name;
          if (!seen[key]) {
            seen[key] = true;
            results.push({ name: songs[j].name, cover: songs[j].cover, quark: songs[j].quark, singer: singer });
          }
        }
      }
    }
    renderResults(results, query);
  }, 350);
}'''

new_doSearch = '''function doSearch() {
  var query = document.getElementById('searchInput').value.trim();
  if (!query) { showToast('请输入歌手名或歌曲名'); return; }
  var container = document.getElementById('resultsContainer');
  container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';
  setTimeout(function() {
    var results = [];
    var q = query.toLowerCase();
    var singerKeys = Object.keys(songDB);
    var seen = {};

    for (var i = 0; i < singerKeys.length; i++) {
      var singer = singerKeys[i];
      var songs = songDB[singer];
      var singerLower = singer.toLowerCase();
      var singerMatch = singerLower.indexOf(q) !== -1;

      for (var j = 0; j < songs.length; j++) {
        var songLower = songs[j].name.toLowerCase();
        var songMatch = songLower.indexOf(q) !== -1;
        // Smart match: query might contain both song and singer (e.g., "晴汪苏泷")
        var combined1 = songLower + singerLower;
        var combined2 = singerLower + songLower;
        var smartMatch = combined1.indexOf(q) !== -1 || combined2.indexOf(q) !== -1;
        // Also check if query contains song name and singer name as substrings
        var containsBoth = q.indexOf(songLower) !== -1 && q.indexOf(singerLower) !== -1;

        if (singerMatch || songMatch || smartMatch || containsBoth) {
          var key = singer + '||' + songs[j].name;
          if (!seen[key]) {
            seen[key] = true;
            results.push({ name: songs[j].name, cover: songs[j].cover, quark: songs[j].quark, singer: singer });
          }
        }
      }
    }
    renderResults(results, query);
  }, 200);
}'''

h = h.replace(old_doSearch, new_doSearch)

# === 2. Add autocomplete dropdown ===
old_search_input = 'id="searchInput" placeholder="输入歌手名或歌曲名" autocomplete="off"'
new_search_input = 'id="searchInput" placeholder="输入歌手名或歌曲名（如：晴汪苏泷、晴-汪苏泷）" autocomplete="off" oninput="showSuggestions()" onkeydown="handleSuggestKey(event)"'
h = h.replace(old_search_input, new_search_input)

# Add suggestion dropdown HTML after search-box
old_search_box_end = '</div>\n    <div id="resultsContainer">'
new_search_box_end = '''</div>
    <div class="suggest-dropdown" id="suggestDropdown" style="display:none"></div>
    <div id="resultsContainer">'''
h = h.replace(old_search_box_end, new_search_box_end)

# === 3. Add CSS for suggestions ===
old_css_insert = '.batch-btn:hover{background:#2d6dc4}'
new_css_insert = '''.batch-btn:hover{background:#2d6dc4}
.suggest-dropdown{position:absolute;background:#fff;border:1px solid #dce6f0;border-radius:0 0 10px 10px;max-height:200px;overflow-y:auto;width:calc(100% - 90px);z-index:200;box-shadow:0 4px 12px rgba(0,0,0,.1)}
.suggest-item{padding:8px 14px;font-size:13px;cursor:pointer;border-bottom:1px solid #f0f3f7}
.suggest-item:hover{background:#f0f5fb}
.suggest-item .match{color:#3a7bd5;font-weight:700}
.suggest-item .rest{color:#999}'''
h = h.replace(old_css_insert, new_css_insert)

# Make search-box position relative for dropdown positioning
h = h.replace('.search-box{display:flex;gap:8px;margin-bottom:28px',
    '.search-box{display:flex;gap:8px;margin-bottom:28px;position:relative')

# === 4. Add JS functions for suggestions ===
old_js_insert = 'function quickSearch(name) {'
new_js_insert = '''// ========== 搜索建议 ==========
function showSuggestions(){
  var q=document.getElementById('searchInput').value.trim();
  var dd=document.getElementById('suggestDropdown');
  if(q.length<2){dd.style.display='none';return;}
  var matches=[];
  var singerKeys=Object.keys(songDB);
  var ql=q.toLowerCase();
  for(var i=0;i<singerKeys.length;i++){
    var singer=singerKeys[i];
    var songs=songDB[singer];
    for(var j=0;j<songs.length;j++){
      var sn=songs[j].name;
      var combo1=sn+singer;
      var combo2=singer+sn;
      var idx1=combo1.toLowerCase().indexOf(ql);
      var idx2=combo2.toLowerCase().indexOf(ql);
      if(idx1>=0) matches.push({display:combo1.substring(idx1,idx1+ql.length+10),start:idx1,song:sn,singer:singer});
      else if(idx2>=0) matches.push({display:combo2.substring(idx2,idx2+ql.length+10),start:idx2,song:sn,singer:singer});
    }
  }
  // Dedup
  var seen={},unique=[];
  for(var i=0;i<matches.length;i++){
    var k=matches[i].song+'||'+matches[i].singer;
    if(!seen[k]){seen[k]=true;unique.push(matches[i]);}
  }
  unique=unique.slice(0,8);
  if(unique.length===0){dd.style.display='none';return;}
  var h='';
  for(var i=0;i<unique.length;i++){
    var d=unique[i].display;
    h+='<div class=\"suggest-item\" onclick=\"selectSuggestion('+i+')\"><span class=\"match\">'+escHtml(d.substring(0,ql.length))+'</span><span class=\"rest\">'+escHtml(d.substring(ql.length))+'</span><span style=\"color:#bbb;font-size:11px;margin-left:8px\">'+escHtml(unique[i].singer)+' - '+escHtml(unique[i].song)+'</span></div>';
  }
  dd.innerHTML=h;
  dd.style.display='block';
  window._suggestions=unique;
}
function selectSuggestion(idx){
  var s=window._suggestions[idx];
  if(s){
    document.getElementById('searchInput').value=s.singer+' '+s.song;
    document.getElementById('suggestDropdown').style.display='none';
    doSearch();
  }
}
function handleSuggestKey(e){
  var dd=document.getElementById('suggestDropdown');
  if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();
    if(dd.style.display==='block'){
      var items=dd.querySelectorAll('.suggest-item');
      if(items.length===0)return;
      window._sugIdx=window._sugIdx||0;
      items[window._sugIdx].style.background='';
      if(e.key==='ArrowDown')window._sugIdx=(window._sugIdx+1)%items.length;
      else window._sugIdx=(window._sugIdx-1+items.length)%items.length;
      items[window._sugIdx].style.background='#f0f5fb';
    }
  }else if(e.key==='Enter'){
    if(dd.style.display==='block'&&window._sugIdx!==undefined){
      e.preventDefault();
      selectSuggestion(window._sugIdx);
      window._sugIdx=undefined;
    }else{
      doSearch();
    }
  }else if(e.key==='Escape'){
    dd.style.display='none';
  }
}
document.addEventListener('click',function(e){
  if(!e.target.closest('#searchInput')&&!e.target.closest('#suggestDropdown')){
    document.getElementById('suggestDropdown').style.display='none';
  }
});

function quickSearch(name) {'''

h = h.replace(old_js_insert, new_js_insert)

# === 5. Update batch search placeholder ===
old_ph = 'placeholder="每行一个搜索项&#10;歌名-歌手（精准搜索）&#10;歌名（模糊搜索）&#10;&#10;例如：&#10;七里香-周杰伦&#10;晴天&#10;孤勇者"'
new_ph = 'placeholder="一行一个，回车换行&#10;例如：&#10;七里香-周杰伦&#10;晴天 林俊杰&#10;孤勇者"'
h = h.replace(old_ph, new_ph)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(h)
print('All changes applied')

# Validate JS
s = h.find('<script>') + 8
e = h.find('</script>', s)
js = h[s:e]
with open('_t.js', 'w', encoding='utf-8') as f:
    f.write(js)
import subprocess
r = subprocess.run(['node', '--check', '_t.js'], capture_output=True)
if r.returncode == 0:
    print('JS OK')
    import os; os.remove('_t.js')
else:
    print('JS ERR: ' + r.stderr.decode()[:300])
