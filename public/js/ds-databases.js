/* vim: set ts=2 sw=2 expandtab : */
  
var db_instances;
var db_charts;
var db_chart;
var menus;

function loadInstances() {
  var $select = $('#inst-sel');
  $select.change();
  $select.empty();
  db_instances[$('#db-sel').val()].forEach(function(opt) {
    $('<option>').val(opt).text(opt).appendTo($select);
  });
  $select.change(showGraph);
}

function showGraph() {
  var cur_chart = db_charts[$('#db-chart-sel').val()];
  $.ajax({
    url: '/api/graph',
    method: 'POST',
    data: {
      ds: $('#ds_id').text(),
      dimensions: [
        { name: 'DB Name', val: $('#db-sel').val(), },
        { name: 'Instance', val: $('#inst-sel').val(), }
      ],
      category: cur_chart.category,
      names: cur_chart.names,
      limit: cur_chart.limit,
      skip: cur_chart.skip,
    },
    success: function(result) {
      if (cur_chart.type) {
        result.type = cur_chart.type;
      }
      if (cur_chart.nogroup) {
        result.groups = undefined;
      }
      db_chart = c3.generate({
        bindto: "#db-chart",
        data: result,
        axis: {
          x: {
            type: 'timeseries',
            tick: {
              format: '%Y-%m-%d %H:%M'
            }
          },
          y: {
            min: (cur_chart.c3 && cur_chart.c3.axis && cur_chart.c3.axis.y) ? cur_chart.c3.axis.y.min + 1 : undefined,
            max: (cur_chart.c3 && cur_chart.c3.axis && cur_chart.c3.axis.y) ? cur_chart.c3.axis.y.max - 1 : undefined,
            label: (cur_chart.c3 && cur_chart.c3.axis && cur_chart.c3.axis.y) ? cur_chart.c3.axis.y.label : undefined,
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
          if (cur_chart.sql) {
            legendMenu(result.columns.slice(1));
          }
        },
      });
      if (cur_chart.type) {
        // for non-area chart types we want to show lines
        $('.c3-chart-lines path.c3-line')
          .css('stroke-width', '2px')
          .css('stroke-linejoin', 'round')
          .css('stroke-opacity', '0.7');
      }
    },
  });
}

function legendMenu(data) {
  menus = data.map(function(arr) {
    var dname = arr[0];
    // set sqlId as data on legend item
    $("#db-chart g.c3-legend-item > text").filter(function() {
      return $(this).text() === dname;
    }).parent().attr('data-sql-id', dname.split(' ')[0]);

    return new BootstrapMenu('#db-chart g.c3-legend-item', {
      /* this provides 'row' argument for onClick function */
      fetchElementData: function(elem) {
        return elem.data('sql-id');
      },
      actions: [{
        name: 'Show SQL details',
        onClick: function(row) {
          var form = $('<form>' 
              + '<input type=hidden name=ds value="' + $('#ds_id').text() + '">'
              + '<input type=hidden name=db value="' + $('#db-sel').val() + '">'
              + '<input type=hidden name=inst value="' + $('#inst-sel').val() + '">'
              + '<input type=hidden name=sqlid value="' + row + '">'
              + '</form>');
          form.attr({
            id: 'linkform',
            action: '/show-sql',
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

function contextMenu(xdata) {
  var menus = xdata.slice(1).map(function(dttm, i) {
    return new BootstrapMenu('#db-chart .c3-event-rect-' + String(i), {
      actions: [{
        name: 'Show AWR',
        onClick: function() {
          var form = $('<form>' 
              + '<input type=hidden name=ds value="' + $('#ds_id').text() + '">'
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

$(document).ready(function() {
  
  var $select = $('#db-sel');
  var $select_ch = $('#db-chart-sel');

  $.when(
    /* load list of databases and instances */
    $.ajax({
      url: '/api/ds-databases',
      type: 'get',
      data: { id: $('#ds_id').text() },
      success: function(ret) {
        db_instances = ret;
        Object.keys(ret).sort().forEach(function(opt) {
          $('<option>').val(opt).text(opt).appendTo($select);
        });
        loadInstances();
        $select.change(function() {
          loadInstances();
          showGraph();
        });
      },
    }),
  
    /* load list of charts */
    $.ajax({
      url: '/api/charts',
      type: 'get',
      success: function(ret) {
        db_charts = ret;
        Object.keys(db_charts).forEach(function(k) {
          $('<option>').val(k).text(db_charts[k].name).appendTo($select_ch);
        });
        $('#db-chart-sel option:contains("Foreground Wait Classes")').attr('selected', 'selected');
        $select_ch.change(showGraph);
      },
    })
  )
  .then(function() {
    showGraph();
  });
 

});


