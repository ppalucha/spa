/* vim: set ts=2 sw=2 expandtab : */

var cur;
var db_instances;

function loadInstances(selCurrent) {
  var select = $('#inst-sel');
  select.change();
  select.empty();
  if ($('#db-sel').val()) db_instances[$('#db-sel').val()].forEach(function(opt) {
    $('<option>').val(opt).text(opt).prop('selected', opt === cur.inst).appendTo(select);
  });
  if (cur.inst) {
    select.val(cur.inst);
  } else {
    cur.inst = select.val();
  }
  select.change(function() {
    cur.inst = $('#inst-sel').val();
  });
  loadSQL();
}

function loadDatabases() {
  var select = $('#db-sel');
   $.ajax({
      url: '/api/ds-databases',
      type: 'get',
      data: { id: cur.ds },
      success: function(ret) {
        select.change();
        select.empty();
        db_instances = ret;
        Object.keys(ret).sort().forEach(function(opt) {
		console.log("OPTION ", opt);
	      console.log("CUR DB", cur.db);
          $('<option>').val(opt).text(opt).prop('selected', opt === cur.db).appendTo(select);
        });
        if (cur.db) {
          select.val(cur.db);
        } else {
          cur.db = select.val();
        }
        loadInstances();
        select.change(function() {
          cur.db = $('#db-sel').val();
          loadInstances();
        });
      },
   });
}

function loadDatasets() {
  var select = $('#ds-sel');
  $.ajax({
    url: '/api/list-ds',
    type: 'get',
    success: function(ret) {
      select.change();
      select.empty();
      ret.data.forEach(function(row) {
        $('<option>').val(row[0]).text(row[1]).appendTo(select);
      });
      if (cur.ds) {      
        select.val(cur.ds);
      } else {
        cur.ds = select.val();
      }
      loadDatabases();
      select.change(function () {
        cur.ds = $('#ds-sel').val();
        loadDatabases();
      });
    },
  });
}

function showModules() {
  $.ajax({
    url: '/api/sql-module',
    type: 'get',
    data: cur,
    success: function(ret) {
      $('#sql-modules').text(ret.join(', '));
    },
  });
}

function loadSQL() {
  $.ajax({
    url: '/api/sql-text',
    type: 'get',
    data: cur,
    success: function(ret) {
      if (ret) {
        $('#sql-text').text(ret);
        $('#sql-text').each(function(i, block) {
          hljs.highlightBlock(block);
        });
        showGraph();
        $('.show-on-sql').removeClass('hidden');
        showModules();
      } else {
        $('#sql-text').replaceWith('<div class="alert alert-danger">No SQL found</div>');
        $('#copy-btn').addClass('disabled');
      }
    },
  });
}

function showGraph() {
  $.ajax({
    url: '/api/graph',
    method: 'POST',
    data: {
      ds: $('#ds-sel').val(),
      dimensions: [
        { name: 'DB Name', val: $('#db-sel').val(), },
        { name: 'Instance', val: $('#inst-sel').val(), },
        { name: 'SQL Id', val: $('#sql-id').val(), },
      ],
      category: 'SQL Impact',
    },
    success: function(result) {
      result.type = 'step';
      db_chart = c3.generate({
        bindto: "#impact-chart",
        data: result,
        axis: {
          x: {
            type: 'timeseries',
            tick: {
              format: '%Y-%m-%d %H:%M'
            }
          },
          y: {
            label: '%',
            min: 0+1,
            max: 100-1,
          },
        },
        legend: {
          position: 'right',
        },
        zoom: {
          enabled: true,
        },
        grid: {
          x: {
            show: true
          },
          y: {
            show: true
          }
        },
        onrendered: function () {
          contextMenu(result.columns[0]);
        },
      });
      $('.c3-chart-lines path.c3-line')
        .css('stroke-width', '2px')
        .css('stroke-linejoin', 'round')
        .css('stroke-opacity', '0.7');
    },
  });
}

function contextMenu(xdata) {
  var menus = xdata.slice(1).map(function(dttm, i) {
    return new BootstrapMenu('.c3-event-rect-' + String(i), {
      actions: [{
        name: 'Show AWR',
        onClick: function() {
          var form = $('<form>' 
              + '<input type=hidden name=ds value="' + $('#ds-sel').val() + '">'
              + '<input type=hidden name=db value="' + $('#db-sel').val() + '">'
              + '<input type=hidden name=inst value="' + $('#inst-sel').val() + '">'
              + '<input type=hidden name=dttm value="' + dttm + '">'
              + '</form>');
          form.attr({
            id: 'linkform',
            action: '/search-awr',
            method: 'GET',
            target: '_blank'
          });
          $('body').append(form);
          $('#linkform').submit();
          $('#linkform').remove();
        }
      }],
    });
  });
}

function setSQLId(name) {
  $('#sql-id').val(name);
  cur.sql = name;
  $('#sql-form').submit();
}

function sqlidSearch() {
  $('#sqlidlist').btsListFilter('#sql-id', {
    minLength: 2,
    resetOnBlur: true,
    sourceTmpl: '<a class="list-group-item" onclick="setSQLId(\'{name}\')"><span><b>{name}</b>: {val}</span></a>',
    sourceData: function(srchText, callback) {
      var q = '/api/sql-search?ds='+$('#ds-sel').val()
        +'&db='+$('#db-sel').val()
        +'&inst='+$('#inst-sel').val()
        +'&id='+srchText;
      return $.getJSON(q, function(json) {
        callback(json);
      });
    },
    cancelNode: function() {
      return '<span id=sql-id-cancel class="btn glyphicon glyphicon-remove form-control-feedback" aria-hidden="true"></span>';
    }
  });
  // this is some bug (?) in bootstap - without this clear button is not clickable
  $('#sql-id-cancel').css('pointer-events', 'auto');
}

function sqltextSearch() {
  $('#sqltextlist').btsListFilter('#search-text', {
    minLength: 7,
    resetOnBlur: true,
    sourceTmpl: '<a class="list-group-item" onclick="setSQLId(\'{name}\')"><span><b>{name}</b>: {val}</span></a>',
    sourceData: function(srchText, callback) {
      var q = '/api/sql-search?ds='+$('#ds-sel').val()
        +'&db='+$('#db-sel').val()
        +'&inst='+$('#inst-sel').val()
        +'&text='+srchText;
      return $.getJSON(q, function(json) {
        callback(json);
      });
    },
    cancelNode: function() {
      return '<span id=search-text-cancel class="btn glyphicon glyphicon-remove form-control-feedback" aria-hidden="true"></span>';
    }
  });
  // this is some bug (?) in bootstap - without this clear button is not clickable
  $('#search-text-cancel').css('pointer-events', 'auto');
}


$(document).ready(function() {
  
  cur = {
    'ds': $('#ds-sel').val(),
    'db': $('#db-sel').val(),
    'inst': $('#inst-sel').val(),
    'sql': $('#sql-id').val(),
  };


  loadDatasets();

  new Clipboard('#copy-btn');
  sqlidSearch();
  sqltextSearch();

});


